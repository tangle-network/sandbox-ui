"use client";

import {
  AlertCircle,
  ChevronRight,
  Copy,
  Edit2,
  Loader2,
  Plus,
  Search,
  Settings2,
  Trash2,
} from "lucide-react";
import * as React from "react";
import { Button } from "../primitives/button";
import { Badge } from "../primitives/badge";
import { Card } from "../primitives/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../primitives/dialog";
import { EmptyState } from "../primitives/empty-state";
import { Input } from "../primitives/input";

export interface ProfileMetrics {
  total_runs: number;
  success_rate: number;
  avg_duration_ms: number;
  avg_tokens_used?: number;
  last_run_at?: string;
}

export interface Profile {
  id: string;
  name: string;
  description?: string;
  extends?: string;
  model?: string;
  system_prompt?: string;
  instructions?: string[];
  tags?: string[];
  is_builtin?: boolean;
  is_public?: boolean;
  metrics?: ProfileMetrics;
  created_at?: string;
  updated_at?: string;
}

export interface ProfileFormData {
  name: string;
  description?: string;
  extends?: string;
  model?: string;
  system_prompt?: string;
  instructions?: string[];
  tags?: string[];
  is_public?: boolean;
}

export interface ProfilesPageProps {
  /** API client for profile operations */
  apiClient: {
    listProfiles: () => Promise<{ builtin: Profile[]; custom: Profile[] }>;
    createProfile: (data: ProfileFormData) => Promise<Profile>;
    updateProfile: (
      id: string,
      data: Partial<ProfileFormData>,
    ) => Promise<Profile>;
    deleteProfile: (id: string) => Promise<void>;
  };
  /** User's subscription tier for limit enforcement */
  tier?: "free" | "starter" | "pro" | "enterprise";
  /** Maximum profiles allowed for current tier */
  maxProfiles?: number;
  /** Callback when navigating to profile comparison */
  onCompareClick?: (profiles: Profile[]) => void;
  /** Custom page title */
  title?: string;
}

const TIER_LIMITS: Record<string, number> = {
  free: 3,
  starter: 10,
  pro: 50,
  enterprise: Number.POSITIVE_INFINITY,
};

export function ProfilesPage({
  apiClient,
  tier = "free",
  maxProfiles,
  onCompareClick,
  title = "Profiles",
}: ProfilesPageProps) {
  const [builtinProfiles, setBuiltinProfiles] = React.useState<Profile[]>([]);
  const [customProfiles, setCustomProfiles] = React.useState<Profile[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [editingProfile, setEditingProfile] = React.useState<Profile | null>(
    null,
  );
  const [deletingProfile, setDeletingProfile] = React.useState<Profile | null>(
    null,
  );
  const [detailProfile, setDetailProfile] = React.useState<Profile | null>(
    null,
  );

  const profileLimit = maxProfiles ?? TIER_LIMITS[tier] ?? 3;
  const canCreateMore = customProfiles.length < profileLimit;

  // Load profiles
  const loadProfiles = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.listProfiles();
      setBuiltinProfiles(data.builtin);
      setCustomProfiles(data.custom);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profiles");
    } finally {
      setLoading(false);
    }
  }, [apiClient]);

  React.useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  // Filter profiles by search
  const filteredBuiltin = builtinProfiles.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchQuery.toLowerCase()),
  );
  const filteredCustom = customProfiles.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-2xl">{title}</h1>
          <p className="text-muted-foreground">
            Customize agent behavior with system prompts, models, and
            instructions
          </p>
        </div>
        <div className="flex items-center gap-3">
          {onCompareClick && customProfiles.length >= 2 && (
            <Button
              variant="outline"
              onClick={() => onCompareClick(customProfiles)}
            >
              Compare Profiles
            </Button>
          )}
          <Button
            onClick={() => setCreateDialogOpen(true)}
            disabled={!canCreateMore}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Profile
          </Button>
        </div>
      </div>

      {/* Tier limit warning */}
      {!canCreateMore && (
        <div className="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-400">
          <AlertCircle className="h-4 w-4" />
          <span>
            You've reached your profile limit ({profileLimit} profiles). Upgrade
            your plan to create more.
          </span>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search profiles..."
          value={searchQuery}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-red-400 text-sm">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={loadProfiles}>
            Retry
          </Button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Content */}
      {!loading && (
        <div className="space-y-8">
          {/* Custom profiles */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-medium text-lg">
                Your Profiles ({customProfiles.length}/
                {profileLimit === Number.POSITIVE_INFINITY ? "inf" : profileLimit}
                )
              </h2>
            </div>
            {filteredCustom.length === 0 ? (
              <EmptyState
                icon={<Settings2 className="h-8 w-8" />}
                title="No custom profiles yet"
                description="Create a profile to customize agent behavior"
                action={
                  canCreateMore ? (
                    <Button onClick={() => setCreateDialogOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Profile
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredCustom.map((profile) => (
                  <ProfileCard
                    key={profile.id}
                    profile={profile}
                    onView={() => setDetailProfile(profile)}
                    onEdit={() => setEditingProfile(profile)}
                    onDelete={() => setDeletingProfile(profile)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Built-in profiles */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-medium text-lg">
                Built-in Profiles ({builtinProfiles.length})
              </h2>
            </div>
            {filteredBuiltin.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No matching built-in profiles
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredBuiltin.map((profile) => (
                  <ProfileCard
                    key={profile.id}
                    profile={profile}
                    onView={() => setDetailProfile(profile)}
                    isBuiltin
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <ProfileFormDialog
        open={createDialogOpen || !!editingProfile}
        onClose={() => {
          setCreateDialogOpen(false);
          setEditingProfile(null);
        }}
        profile={editingProfile}
        builtinProfiles={builtinProfiles}
        apiClient={apiClient}
        onSuccess={() => {
          setCreateDialogOpen(false);
          setEditingProfile(null);
          loadProfiles();
        }}
      />

      {/* Delete Confirmation */}
      <DeleteProfileDialog
        profile={deletingProfile}
        onClose={() => setDeletingProfile(null)}
        apiClient={apiClient}
        onSuccess={() => {
          setDeletingProfile(null);
          loadProfiles();
        }}
      />

      {/* Profile Detail */}
      <ProfileDetailDialog
        profile={detailProfile}
        onClose={() => setDetailProfile(null)}
        onEdit={
          detailProfile && !detailProfile.is_builtin
            ? () => {
                setDetailProfile(null);
                setEditingProfile(detailProfile);
              }
            : undefined
        }
        onDuplicate={
          canCreateMore
            ? () => {
                setDetailProfile(null);
                setEditingProfile({
                  ...detailProfile!,
                  id: "",
                  name: `${detailProfile?.name}-copy`,
                  is_builtin: false,
                });
              }
            : undefined
        }
      />
    </div>
  );
}

// ============================================================================
// ProfileCard Component
// ============================================================================

interface ProfileCardProps {
  profile: Profile;
  onView: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  isBuiltin?: boolean;
}

function ProfileCard({
  profile,
  onView,
  onEdit,
  onDelete,
  isBuiltin,
}: ProfileCardProps) {
  return (
    <Card
      className="cursor-pointer p-4 transition-colors hover:border-border/80"
      onClick={onView}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium">{profile.name}</h3>
            {isBuiltin && (
              <Badge variant="secondary" className="border-0 text-xs">
                Built-in
              </Badge>
            )}
            {profile.is_public && !isBuiltin && (
              <Badge className="border-0 bg-blue-500/10 text-blue-400 text-xs">
                Public
              </Badge>
            )}
          </div>
          {profile.description && (
            <p className="mt-1 line-clamp-2 text-muted-foreground text-sm">
              {profile.description}
            </p>
          )}
        </div>
        {!isBuiltin && (
          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
            {onEdit && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onEdit}
                aria-label="Edit profile"
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onDelete}
                aria-label="Delete profile"
              >
                <Trash2 className="h-4 w-4 text-red-400" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="mt-3 flex flex-wrap gap-2">
        {profile.extends && (
          <Badge variant="outline" className="text-xs">
            extends {profile.extends}
          </Badge>
        )}
        {profile.model && (
          <Badge variant="outline" className="text-xs">
            {profile.model.split("/").pop()}
          </Badge>
        )}
      </div>

      {/* Metrics */}
      {profile.metrics && profile.metrics.total_runs > 0 && (
        <div className="mt-3 flex gap-4 border-border border-t pt-3 text-muted-foreground text-xs">
          <span>{profile.metrics.total_runs} runs</span>
          <span>{profile.metrics.success_rate.toFixed(0)}% success</span>
          <span>
            ~{(profile.metrics.avg_duration_ms / 1000).toFixed(1)}s avg
          </span>
        </div>
      )}
    </Card>
  );
}

// ============================================================================
// ProfileFormDialog Component
// ============================================================================

interface ProfileFormDialogProps {
  open: boolean;
  onClose: () => void;
  profile?: Profile | null;
  builtinProfiles: Profile[];
  apiClient: ProfilesPageProps["apiClient"];
  onSuccess: () => void;
}

function ProfileFormDialog({
  open,
  onClose,
  profile,
  builtinProfiles,
  apiClient,
  onSuccess,
}: ProfileFormDialogProps) {
  const isEditing = !!profile?.id;
  const [formData, setFormData] = React.useState<ProfileFormData>({
    name: "",
    description: "",
    extends: "",
    model: "",
    system_prompt: "",
    instructions: [],
    tags: [],
    is_public: false,
  });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Populate form when editing
  React.useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name,
        description: profile.description ?? "",
        extends: profile.extends ?? "",
        model: profile.model ?? "",
        system_prompt: profile.system_prompt ?? "",
        instructions: profile.instructions ?? [],
        tags: profile.tags ?? [],
        is_public: profile.is_public ?? false,
      });
    } else {
      setFormData({
        name: "",
        description: "",
        extends: "",
        model: "",
        system_prompt: "",
        instructions: [],
        tags: [],
        is_public: false,
      });
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      // Clean up empty values
      const cleanData: ProfileFormData = {
        name: formData.name,
        ...(formData.description && { description: formData.description }),
        ...(formData.extends && { extends: formData.extends }),
        ...(formData.model && { model: formData.model }),
        ...(formData.system_prompt && {
          system_prompt: formData.system_prompt,
        }),
        ...(formData.instructions?.length && {
          instructions: formData.instructions,
        }),
        ...(formData.tags?.length && { tags: formData.tags }),
        is_public: formData.is_public,
      };

      if (isEditing) {
        await apiClient.updateProfile(profile!.id, cleanData);
      } else {
        await apiClient.createProfile(cleanData);
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Profile" : "Create Profile"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update your custom profile configuration"
              : "Create a new profile to customize agent behavior"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-red-400 text-sm">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="mb-1 block font-medium text-sm">Name *</label>
            <Input
              value={formData.name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData((d) => ({ ...d, name: e.target.value }))
              }
              placeholder="my-custom-profile"
              required
              pattern="^[a-zA-Z0-9_-]+$"
              title="Only letters, numbers, hyphens, and underscores"
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1 block font-medium text-sm">
              Description
            </label>
            <Input
              value={formData.description}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData((d) => ({ ...d, description: e.target.value }))
              }
              placeholder="A brief description of this profile"
            />
          </div>

          {/* Extends */}
          <div>
            <label className="mb-1 block font-medium text-sm">
              Extends (base profile)
            </label>
            <select
              value={formData.extends}
              onChange={(e) =>
                setFormData((d) => ({ ...d, extends: e.target.value }))
              }
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">None (start from scratch)</option>
              {builtinProfiles.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name} - {p.description ?? "Built-in profile"}
                </option>
              ))}
            </select>
          </div>

          {/* Model */}
          <div>
            <label className="mb-1 block font-medium text-sm">Model</label>
            <Input
              value={formData.model}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData((d) => ({ ...d, model: e.target.value }))
              }
              placeholder="anthropic/claude-sonnet-4"
            />
            <p className="mt-1 text-muted-foreground text-xs">
              Format: provider/model-id (e.g., anthropic/claude-sonnet-4)
            </p>
          </div>

          {/* System Prompt */}
          <div>
            <label className="mb-1 block font-medium text-sm">
              System Prompt
            </label>
            <textarea
              value={formData.system_prompt}
              onChange={(e) =>
                setFormData((d) => ({ ...d, system_prompt: e.target.value }))
              }
              placeholder="Custom system prompt for the agent..."
              rows={4}
              className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="mb-1 block font-medium text-sm">Tags</label>
            <Input
              value={formData.tags?.join(", ")}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData((d) => ({
                  ...d,
                  tags: e.target.value
                    .split(",")
                    .map((t: string) => t.trim())
                    .filter(Boolean),
                }))
              }
              placeholder="trading, aggressive, experimental"
            />
            <p className="mt-1 text-muted-foreground text-xs">
              Comma-separated tags for organization
            </p>
          </div>

          {/* Public toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_public"
              checked={formData.is_public}
              onChange={(e) =>
                setFormData((d) => ({ ...d, is_public: e.target.checked }))
              }
              className="rounded border-border"
            />
            <label htmlFor="is_public" className="text-sm">
              Make this profile public (visible to other users)
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !formData.name}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Create Profile"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// DeleteProfileDialog Component
// ============================================================================

interface DeleteProfileDialogProps {
  profile: Profile | null;
  onClose: () => void;
  apiClient: ProfilesPageProps["apiClient"];
  onSuccess: () => void;
}

function DeleteProfileDialog({
  profile,
  onClose,
  apiClient,
  onSuccess,
}: DeleteProfileDialogProps) {
  const [deleting, setDeleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleDelete = async () => {
    if (!profile) return;
    setError(null);
    setDeleting(true);

    try {
      await apiClient.deleteProfile(profile.id);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete profile");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={!!profile} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Profile</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete "{profile?.name}"? This action
            cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-red-400 text-sm">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}

        {profile?.metrics && profile.metrics.total_runs > 0 && (
          <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-400">
            This profile has {profile.metrics.total_runs} recorded runs.
            Deleting it will lose all performance metrics.
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete Profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// ProfileDetailDialog Component
// ============================================================================

interface ProfileDetailDialogProps {
  profile: Profile | null;
  onClose: () => void;
  onEdit?: () => void;
  onDuplicate?: () => void;
}

function ProfileDetailDialog({
  profile,
  onClose,
  onEdit,
  onDuplicate,
}: ProfileDetailDialogProps) {
  if (!profile) return null;

  return (
    <Dialog open={!!profile} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>{profile.name}</DialogTitle>
            {profile.is_builtin && (
              <Badge variant="secondary" className="border-0">
                Built-in
              </Badge>
            )}
            {profile.is_public && !profile.is_builtin && (
              <Badge className="border-0 bg-blue-500/10 text-blue-400">
                Public
              </Badge>
            )}
          </div>
          {profile.description && (
            <DialogDescription>{profile.description}</DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4">
          {/* Metadata */}
          <div className="grid gap-4 sm:grid-cols-2">
            {profile.extends && (
              <div>
                <label className="font-medium text-muted-foreground text-xs">
                  Extends
                </label>
                <p className="text-sm">{profile.extends}</p>
              </div>
            )}
            {profile.model && (
              <div>
                <label className="font-medium text-muted-foreground text-xs">
                  Model
                </label>
                <p className="text-sm">{profile.model}</p>
              </div>
            )}
          </div>

          {/* Tags */}
          {profile.tags && profile.tags.length > 0 && (
            <div>
              <label className="font-medium text-muted-foreground text-xs">
                Tags
              </label>
              <div className="mt-1 flex flex-wrap gap-1">
                {profile.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* System Prompt */}
          {profile.system_prompt && (
            <div>
              <label className="font-medium text-muted-foreground text-xs">
                System Prompt
              </label>
              <div className="relative mt-1">
                <pre className="max-h-48 overflow-auto rounded-lg bg-muted p-3 font-mono text-sm">
                  {profile.system_prompt}
                </pre>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={() =>
                    navigator.clipboard.writeText(profile.system_prompt!)
                  }
                  aria-label="Copy system prompt"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Instructions */}
          {profile.instructions && profile.instructions.length > 0 && (
            <div>
              <label className="font-medium text-muted-foreground text-xs">
                Instructions
              </label>
              <ul className="mt-1 space-y-1">
                {profile.instructions.map((inst, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <ChevronRight className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    {inst}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Metrics */}
          {profile.metrics && profile.metrics.total_runs > 0 && (
            <div className="rounded-lg border border-border p-4">
              <label className="font-medium text-muted-foreground text-xs">
                Performance Metrics
              </label>
              <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <p className="font-medium text-2xl">
                    {profile.metrics.total_runs}
                  </p>
                  <p className="text-muted-foreground text-xs">Total Runs</p>
                </div>
                <div>
                  <p className="font-medium text-2xl">
                    {profile.metrics.success_rate.toFixed(0)}%
                  </p>
                  <p className="text-muted-foreground text-xs">Success Rate</p>
                </div>
                <div>
                  <p className="font-medium text-2xl">
                    {(profile.metrics.avg_duration_ms / 1000).toFixed(1)}s
                  </p>
                  <p className="text-muted-foreground text-xs">Avg Duration</p>
                </div>
                {profile.metrics.avg_tokens_used && (
                  <div>
                    <p className="font-medium text-2xl">
                      {profile.metrics.avg_tokens_used.toLocaleString()}
                    </p>
                    <p className="text-muted-foreground text-xs">Avg Tokens</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {onDuplicate && (
            <Button variant="outline" onClick={onDuplicate}>
              <Copy className="mr-2 h-4 w-4" />
              Duplicate
            </Button>
          )}
          {onEdit && (
            <Button onClick={onEdit}>
              <Edit2 className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
