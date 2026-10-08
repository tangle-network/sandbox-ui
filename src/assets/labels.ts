import type { AssetFormat, AssetStatus } from "./types";

/** Reader-facing name for each asset format. */
export const ASSET_FORMAT_LABEL: Record<AssetFormat, string> = {
  email: "Email",
  "image:feed": "Feed image",
  "image:story": "Story",
  "image:carousel": "Carousel",
  "video:reel": "Reel",
  "video:feed": "Feed video",
  "copy:caption": "Caption",
  "copy:headline": "Headline",
  "copy:sms": "SMS"
};

/** Reader-facing name for each review status. */
export const ASSET_STATUS_LABEL: Record<AssetStatus, string> = {
  draft: "Draft",
  pending_review: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
  scheduled: "Scheduled",
  published: "Published"
};
