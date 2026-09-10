export type ProfileRole = "owner" | "member" | "viewer";
export type ProfileMemberStatus = "invited" | "active";

export interface ProfileSummary {
  id: string;
  name: string;
  role: ProfileRole;
  status: ProfileMemberStatus;
  createdBy: string;
  createdAt: string;
  memberId: string;
}

export interface ProfileMember {
  id: string;
  email: string;
  role: ProfileRole;
  status: ProfileMemberStatus;
  userId: string | null;
  invitedBy: string | null;
  createdAt: string;
  splitPercent: number;
}
