import express from "express";
import { isLoggedIn } from "../middleware.js";
import { supabase } from "../lib/supabase.js";
import { writeLimiter } from "../lib/rateLimit.js";
import {
	INVITE_ROLES,
	activateInvitesForUser,
	clipName,
	createProfile,
	ensureDefaultProfile,
	inviteToProfile,
	isUuid,
	isValidEmail,
	listActiveProfiles,
	listMembers,
	loadActiveMembership,
	loadClerkUser,
	loadMembershipById,
	loadProfile,
	maybeRevokeClerkInvitation,
	normalizeEmail,
	primaryEmail,
	syncMemberEmails,
	userEmails,
} from "../lib/profile.js";

const router = express.Router();

async function requireOwnerMembership(req, res) {
	const { id } = req.params;
	if (!isUuid(id)) {
		res.status(400).send({ message: "Invalid profile id" });
		return null;
	}
	const membership = await loadActiveMembership(req.userId, id);
	if (!membership) {
		res.status(403).send({ message: "You do not have access to this profile" });
		return null;
	}
	if (membership.role !== "owner") {
		res.status(403).send({ message: "Only the owner can do that" });
		return null;
	}
	return membership;
}

router.get("/", isLoggedIn, async (req, res) => {
	try {
		const user = await loadClerkUser(req.userId);
		const emails = userEmails(user);
		const email = primaryEmail(user);
		await activateInvitesForUser(req.userId, emails);
		await syncMemberEmails(req.userId, email);
		const profiles = await ensureDefaultProfile(req.userId, email);
		return res.status(200).json({ profiles });
	} catch (err) {
		console.log(err.message);
		res.status(500).send({ message: err.message });
	}
});

router.post("/", isLoggedIn, writeLimiter, async (req, res) => {
	try {
		const name = clipName(req.body.name);
		if (!name) {
			return res.status(400).send({ message: "Name is required" });
		}
		const user = await loadClerkUser(req.userId);
		const profile = await createProfile(req.userId, primaryEmail(user), name);
		return res.status(201).send(profile);
	} catch (err) {
		console.log(err.message);
		res.status(500).send({ message: err.message });
	}
});

router.patch("/:id", isLoggedIn, writeLimiter, async (req, res) => {
	try {
		const owner = await requireOwnerMembership(req, res);
		if (!owner) return;

		const name = clipName(req.body.name);
		if (!name) {
			return res.status(400).send({ message: "Name is required" });
		}

		const { data, error } = await supabase
			.from("profiles")
			.update({ name })
			.eq("id", req.params.id)
			.select("id, name, created_by, created_at")
			.maybeSingle();
		if (error) throw error;
		if (!data) {
			return res.status(404).send({ message: "Profile not found" });
		}

		const profiles = await listActiveProfiles(req.userId);
		const updated = profiles.find((item) => item.id === data.id);
		return res.status(200).send(updated || { ...data, role: "owner", status: "active" });
	} catch (err) {
		console.log(err.message);
		res.status(500).send({ message: err.message });
	}
});

router.delete("/:id", isLoggedIn, writeLimiter, async (req, res) => {
	try {
		const owner = await requireOwnerMembership(req, res);
		if (!owner) return;

		const { data, error } = await supabase
			.from("profiles")
			.delete()
			.eq("id", req.params.id)
			.select("id")
			.maybeSingle();
		if (error) throw error;
		if (!data) {
			return res.status(404).send({ message: "Profile not found" });
		}
		return res.status(200).send({ id: req.params.id, message: "Profile deleted" });
	} catch (err) {
		console.log(err.message);
		res.status(500).send({ message: err.message });
	}
});

router.get("/:id/members", isLoggedIn, async (req, res) => {
	try {
		const { id } = req.params;
		if (!isUuid(id)) {
			return res.status(400).send({ message: "Invalid profile id" });
		}
		const membership = await loadActiveMembership(req.userId, id);
		if (!membership) {
			return res
				.status(403)
				.send({ message: "You do not have access to this profile" });
		}
		const members = await listMembers(id);
		return res.status(200).json({ members });
	} catch (err) {
		console.log(err.message);
		res.status(500).send({ message: err.message });
	}
});

router.post("/:id/invites", isLoggedIn, writeLimiter, async (req, res) => {
	try {
		const owner = await requireOwnerMembership(req, res);
		if (!owner) return;

		const email = normalizeEmail(req.body.email);
		const role = String(req.body.role || "").trim();
		if (!isValidEmail(email)) {
			return res.status(400).send({ message: "A valid email is required" });
		}
		if (!INVITE_ROLES.has(role)) {
			return res.status(400).send({ message: "Role must be member or viewer" });
		}

		const profile = await loadProfile(req.params.id);
		if (!profile) {
			return res.status(404).send({ message: "Profile not found" });
		}

		const user = await loadClerkUser(req.userId);
		const result = await inviteToProfile({
			profileId: req.params.id,
			email,
			role,
			invitedBy: req.userId,
			inviterEmails: userEmails(user),
		});
		return res.status(201).send(result);
	} catch (err) {
		if (err.status) {
			return res.status(err.status).send({ message: err.message });
		}
		console.log(err.message);
		res.status(500).send({ message: err.message });
	}
});

router.patch("/:id/members/:memberId", isLoggedIn, writeLimiter, async (req, res) => {
	try {
		const owner = await requireOwnerMembership(req, res);
		if (!owner) return;

		const { id, memberId } = req.params;
		if (!isUuid(memberId)) {
			return res.status(400).send({ message: "Invalid member id" });
		}

		const member = await loadMembershipById(id, memberId);
		if (!member) {
			return res.status(404).send({ message: "Member not found" });
		}
		if (member.role === "owner") {
			return res.status(400).send({ message: "The owner cannot be changed" });
		}

		const role = String(req.body.role || "").trim();
		if (!INVITE_ROLES.has(role)) {
			return res.status(400).send({ message: "Role must be member or viewer" });
		}

		const { data, error } = await supabase
			.from("profile_members")
			.update({ role })
			.eq("id", memberId)
			.eq("profile_id", id)
			.select(
				"id, profile_id, role, status, email, user_id, invited_by, clerk_invitation_id, created_at"
			)
			.maybeSingle();
		if (error) throw error;
		return res.status(200).send({
			id: data.id,
			email: data.email,
			role: data.role,
			status: data.status,
			userId: data.user_id || null,
			invitedBy: data.invited_by || null,
			createdAt: data.created_at,
		});
	} catch (err) {
		console.log(err.message);
		res.status(500).send({ message: err.message });
	}
});

router.delete("/:id/members/:memberId", isLoggedIn, writeLimiter, async (req, res) => {
	try {
		const { id, memberId } = req.params;
		if (!isUuid(id) || !isUuid(memberId)) {
			return res.status(400).send({ message: "Invalid id" });
		}

		const membership = await loadActiveMembership(req.userId, id);
		if (!membership) {
			return res
				.status(403)
				.send({ message: "You do not have access to this profile" });
		}

		const member = await loadMembershipById(id, memberId);
		if (!member) {
			return res.status(404).send({ message: "Member not found" });
		}

		const leaving = member.id === membership.id;
		if (leaving && membership.role === "owner") {
			return res.status(400).send({
				message: "Owners cannot leave. Delete the profile instead.",
			});
		}
		if (!leaving && membership.role !== "owner") {
			return res.status(403).send({ message: "Only the owner can remove members" });
		}
		if (member.role === "owner") {
			return res.status(400).send({ message: "The owner cannot be removed" });
		}

		const { error } = await supabase
			.from("profile_members")
			.delete()
			.eq("id", memberId)
			.eq("profile_id", id);
		if (error) throw error;

		if (member.status === "invited") {
			await maybeRevokeClerkInvitation(member.email, member.clerk_invitation_id);
		}

		return res.status(200).send({
			id: memberId,
			message: leaving ? "Left profile" : "Member removed",
		});
	} catch (err) {
		console.log(err.message);
		res.status(500).send({ message: err.message });
	}
});

export default router;
