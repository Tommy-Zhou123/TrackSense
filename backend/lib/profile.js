import { clerkClient } from "@clerk/express";
import { supabase } from "./supabase.js";
import { frontendUrl } from "../config.js";
import { isUniqueViolation } from "./overarchingCategory.js";

export const PROFILE_ROLES = new Set(["owner", "member", "viewer"]);
export const INVITE_ROLES = new Set(["member", "viewer"]);
export const MAX_PROFILE_NAME = 80;

const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MEMBER_SELECT =
	"id, profile_id, role, status, email, user_id, invited_by, clerk_invitation_id, created_at";

export function isUuid(value) {
	return UUID_RE.test(String(value || ""));
}

export function clipName(value) {
	return String(value || "").trim().slice(0, MAX_PROFILE_NAME);
}

export function normalizeEmail(value) {
	return String(value || "").trim().toLowerCase();
}

export function isValidEmail(value) {
	const email = normalizeEmail(value);
	return email.length > 3 && email.length <= 254 && EMAIL_RE.test(email);
}

export function userEmails(user) {
	const emails = new Set();
	for (const item of user?.emailAddresses || []) {
		const email = normalizeEmail(item.emailAddress);
		if (email) emails.add(email);
	}
	const primary = normalizeEmail(user?.primaryEmailAddress?.emailAddress);
	if (primary) emails.add(primary);
	return [...emails];
}

export function primaryEmail(user) {
	return (
		normalizeEmail(user?.primaryEmailAddress?.emailAddress) ||
		userEmails(user)[0] ||
		""
	);
}

export function mapProfile(row) {
	const nested = row.profiles || row.profile || {};
	const profile = Array.isArray(nested) ? nested[0] || {} : nested;
	return {
		id: row.profile_id || profile.id,
		name: profile.name || "",
		role: row.role,
		status: row.status,
		createdBy: profile.created_by || "",
		createdAt: profile.created_at || row.created_at,
		memberId: row.id,
	};
}

export function mapMember(row) {
	return {
		id: row.id,
		email: row.email,
		role: row.role,
		status: row.status,
		userId: row.user_id || null,
		invitedBy: row.invited_by || null,
		createdAt: row.created_at,
	};
}

export async function loadActiveMembership(userId, profileId) {
	const { data, error } = await supabase
		.from("profile_members")
		.select(MEMBER_SELECT)
		.eq("profile_id", profileId)
		.eq("user_id", userId)
		.eq("status", "active")
		.maybeSingle();
	if (error) throw error;
	return data;
}

export async function loadMembershipById(profileId, memberId) {
	const { data, error } = await supabase
		.from("profile_members")
		.select(MEMBER_SELECT)
		.eq("id", memberId)
		.eq("profile_id", profileId)
		.maybeSingle();
	if (error) throw error;
	return data;
}

export async function loadProfile(profileId) {
	const { data, error } = await supabase
		.from("profiles")
		.select("id, name, created_by, created_at")
		.eq("id", profileId)
		.maybeSingle();
	if (error) throw error;
	return data;
}

export async function listActiveProfiles(userId) {
	const { data, error } = await supabase
		.from("profile_members")
		.select(
			"id, profile_id, role, status, created_at, profiles!inner(id, name, created_by, created_at)"
		)
		.eq("user_id", userId)
		.eq("status", "active")
		.order("created_at", { ascending: true });
	if (error) throw error;
	return (data || []).map(mapProfile);
}

export async function listMembers(profileId) {
	const { data, error } = await supabase
		.from("profile_members")
		.select(MEMBER_SELECT)
		.eq("profile_id", profileId)
		.order("created_at", { ascending: true });
	if (error) throw error;
	return (data || []).map(mapMember);
}

export async function listActiveMembers(profileId) {
	const { data, error } = await supabase
		.from("profile_members")
		.select(MEMBER_SELECT)
		.eq("profile_id", profileId)
		.eq("status", "active")
		.order("created_at", { ascending: true });
	if (error) throw error;
	return (data || []).map(mapMember);
}

export async function activeMemberOnProfile(profileId, memberId) {
	if (!isUuid(memberId)) return null;
	const { data, error } = await supabase
		.from("profile_members")
		.select("id")
		.eq("id", memberId)
		.eq("profile_id", profileId)
		.eq("status", "active")
		.maybeSingle();
	if (error) throw error;
	return data;
}

export async function activateInvitesForUser(userId, emails) {
	if (!emails.length) return;
	const { error } = await supabase
		.from("profile_members")
		.update({ status: "active", user_id: userId })
		.in("email", emails)
		.eq("status", "invited")
		.is("user_id", null);
	if (error) throw error;
}

export async function syncMemberEmails(userId, email) {
	if (!email) return;
	const { error } = await supabase
		.from("profile_members")
		.update({ email })
		.eq("user_id", userId)
		.eq("status", "active")
		.like("email", "%@clerk.local");
	if (error && !isUniqueViolation(error)) throw error;
}

export async function ensureDefaultProfile(userId, email) {
	const existing = await listActiveProfiles(userId);
	if (existing.length > 0) return existing;

	const { data: profile, error: profileError } = await supabase
		.from("profiles")
		.insert({
			name: "Personal",
			created_by: userId,
		})
		.select("id, name, created_by, created_at")
		.single();
	if (profileError) throw profileError;

	const { error: memberError } = await supabase.from("profile_members").insert({
		profile_id: profile.id,
		role: "owner",
		status: "active",
		email: email || `${userId.toLowerCase()}@clerk.local`,
		user_id: userId,
		invited_by: userId,
	});
	if (memberError) throw memberError;

	return listActiveProfiles(userId);
}

export async function createProfile(userId, email, name) {
	const { data: profile, error: profileError } = await supabase
		.from("profiles")
		.insert({
			name,
			created_by: userId,
		})
		.select("id, name, created_by, created_at")
		.single();
	if (profileError) throw profileError;

	const { data: member, error: memberError } = await supabase
		.from("profile_members")
		.insert({
			profile_id: profile.id,
			role: "owner",
			status: "active",
			email: email || `${userId.toLowerCase()}@clerk.local`,
			user_id: userId,
			invited_by: userId,
		})
		.select(MEMBER_SELECT)
		.single();
	if (memberError) throw memberError;

	return mapProfile({ ...member, profiles: profile });
}

async function findClerkUserByEmail(email) {
	const result = await clerkClient.users.getUserList({
		emailAddress: [email],
		limit: 5,
	});
	const users = result.data || result || [];
	return users.find((user) => userEmails(user).includes(email)) || null;
}

async function findPendingInvitation(email) {
	try {
		const result = await clerkClient.invitations.getInvitationList({
			status: "pending",
			query: email,
			limit: 20,
		});
		const invitations = result.data || result || [];
		return (
			invitations.find(
				(item) => normalizeEmail(item.emailAddress) === email
			) || null
		);
	} catch {
		return null;
	}
}

export async function inviteToProfile({
	profileId,
	email,
	role,
	invitedBy,
	inviterEmails,
}) {
	if (inviterEmails.includes(email)) {
		const error = new Error("You cannot invite yourself");
		error.status = 400;
		throw error;
	}

	const existingMember = await supabase
		.from("profile_members")
		.select("id, status")
		.eq("profile_id", profileId)
		.eq("email", email)
		.maybeSingle();
	if (existingMember.error) throw existingMember.error;
	if (existingMember.data) {
		const error = new Error(
			existingMember.data.status === "invited"
				? "That email already has a pending invite"
				: "That person is already on this profile"
		);
		error.status = 409;
		throw error;
	}

	const clerkUser = await findClerkUserByEmail(email);
	if (clerkUser) {
		const { data, error } = await supabase
			.from("profile_members")
			.insert({
				profile_id: profileId,
				role,
				status: "active",
				email,
				user_id: clerkUser.id,
				invited_by: invitedBy,
			})
			.select(MEMBER_SELECT)
			.single();
		if (error) {
			if (isUniqueViolation(error)) {
				const conflict = new Error("That person is already on this profile");
				conflict.status = 409;
				throw conflict;
			}
			throw error;
		}
		return { member: mapMember(data), invited: false };
	}

	let invitation = await findPendingInvitation(email);
	if (!invitation) {
		try {
			invitation = await clerkClient.invitations.createInvitation({
				emailAddress: email,
				redirectUrl: `${frontendUrl}/register`,
				notify: true,
				publicMetadata: { invited: true },
			});
		} catch (err) {
			const clerkUser = await findClerkUserByEmail(email);
			if (clerkUser) {
				const { data, error } = await supabase
					.from("profile_members")
					.insert({
						profile_id: profileId,
						role,
						status: "active",
						email,
						user_id: clerkUser.id,
						invited_by: invitedBy,
					})
					.select(MEMBER_SELECT)
					.single();
				if (error) {
					if (isUniqueViolation(error)) {
						const conflict = new Error("That person is already on this profile");
						conflict.status = 409;
						throw conflict;
					}
					throw error;
				}
				return { member: mapMember(data), invited: false };
			}
			throw err;
		}
	}

	const { data, error } = await supabase
		.from("profile_members")
		.insert({
			profile_id: profileId,
			role,
			status: "invited",
			email,
			invited_by: invitedBy,
			clerk_invitation_id: invitation.id || null,
		})
		.select(MEMBER_SELECT)
		.single();
	if (error) {
		if (isUniqueViolation(error)) {
			const conflict = new Error("That email already has a pending invite");
			conflict.status = 409;
			throw conflict;
		}
		throw error;
	}
	return { member: mapMember(data), invited: true };
}

export async function maybeRevokeClerkInvitation(email, invitationId) {
	if (!invitationId && !email) return;
	const { data, error } = await supabase
		.from("profile_members")
		.select("id")
		.eq("status", "invited")
		.eq("email", email)
		.limit(1);
	if (error) throw error;
	if ((data || []).length > 0) return;
	if (!invitationId) return;
	try {
		await clerkClient.invitations.revokeInvitation(invitationId);
	} catch {
		// Invitation may already be accepted, expired, or revoked
	}
}

export async function loadClerkUser(userId) {
	return clerkClient.users.getUser(userId);
}
