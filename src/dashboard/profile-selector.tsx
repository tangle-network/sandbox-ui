"use client";

import { Check, ChevronDown, Plus, Settings } from "lucide-react";
import { Button } from "../primitives/button";
import { Badge } from "../primitives/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../primitives/dropdown-menu";

export interface Profile {
  id: string;
  name: string;
  description?: string;
  is_builtin?: boolean;
  extends?: string;
  model?: string;
  metrics?: {
    total_runs: number;
    success_rate: number;
    avg_duration_ms: number;
  };
}

export interface ProfileSelectorProps {
  profiles: Profile[];
  selectedId?: string | null;
  onSelect: (profile: Profile | null) => void;
  onCreateClick?: () => void;
  onManageClick?: () => void;
  label?: string;
  placeholder?: string;
  showMetrics?: boolean;
  className?: string;
}

export function ProfileSelector({
  profiles,
  selectedId,
  onSelect,
  onCreateClick,
  onManageClick,
  label = "Profile",
  placeholder = "Default (no custom profile)",
  showMetrics = true,
  className,
}: ProfileSelectorProps) {
  const selected = profiles.find((p) => p.id === selectedId);
  const builtinProfiles = profiles.filter((p) => p.is_builtin);
  const customProfiles = profiles.filter((p) => !p.is_builtin);

  return (
    <div className={className}>
      {label && (
        <label className="mb-2 block font-medium text-sm">{label}</label>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <span className="truncate">
              {selected ? selected.name : placeholder}
            </span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[300px]" align="start">
          {/* Default (no profile) */}
          <DropdownMenuItem
            onClick={() => onSelect(null)}
            className="flex items-center justify-between"
          >
            <span>{placeholder}</span>
            {!selectedId && <Check className="h-4 w-4 text-[var(--surface-success-text)]" />}
          </DropdownMenuItem>

          {/* Built-in profiles */}
          {builtinProfiles.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Built-in Profiles</DropdownMenuLabel>
              {builtinProfiles.map((profile) => (
                <DropdownMenuItem
                  key={profile.id}
                  onClick={() => onSelect(profile)}
                  className="flex flex-col items-start gap-1"
                >
                  <div className="flex w-full items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{profile.name}</span>
                      {profile.extends && (
                        <Badge variant="secondary" className="border-0 text-xs">
                          extends {profile.extends}
                        </Badge>
                      )}
                    </div>
                    {selectedId === profile.id && (
                      <Check className="h-4 w-4 text-[var(--surface-success-text)]" />
                    )}
                  </div>
                  {profile.description && (
                    <span className="line-clamp-1 text-muted-foreground text-xs">
                      {profile.description}
                    </span>
                  )}
                </DropdownMenuItem>
              ))}
            </>
          )}

          {/* Custom profiles */}
          {customProfiles.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Custom Profiles</DropdownMenuLabel>
              {customProfiles.map((profile) => (
                <DropdownMenuItem
                  key={profile.id}
                  onClick={() => onSelect(profile)}
                  className="flex flex-col items-start gap-1"
                >
                  <div className="flex w-full items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{profile.name}</span>
                      {profile.model && (
                        <Badge variant="secondary" className="border-0 text-xs">
                          {profile.model.split("/").pop()}
                        </Badge>
                      )}
                    </div>
                    {selectedId === profile.id && (
                      <Check className="h-4 w-4 text-[var(--surface-success-text)]" />
                    )}
                  </div>
                  {profile.description && (
                    <span className="line-clamp-1 text-muted-foreground text-xs">
                      {profile.description}
                    </span>
                  )}
                  {showMetrics &&
                    profile.metrics &&
                    profile.metrics.total_runs > 0 && (
                      <div className="flex gap-3 text-muted-foreground text-xs">
                        <span>{profile.metrics.total_runs} runs</span>
                        <span>
                          {profile.metrics.success_rate.toFixed(0)}% success
                        </span>
                        <span>
                          ~{(profile.metrics.avg_duration_ms / 1000).toFixed(1)}
                          s avg
                        </span>
                      </div>
                    )}
                </DropdownMenuItem>
              ))}
            </>
          )}

          {/* Actions */}
          {(onCreateClick || onManageClick) && (
            <>
              <DropdownMenuSeparator />
              {onCreateClick && (
                <DropdownMenuItem
                  onClick={onCreateClick}
                  className="text-[var(--surface-info-text)]"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create New Profile
                </DropdownMenuItem>
              )}
              {onManageClick && (
                <DropdownMenuItem
                  onClick={onManageClick}
                  className="text-muted-foreground"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Manage Profiles
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/**
 * Profile performance comparison card.
 * Shows metrics from multiple profiles side by side.
 */
export interface ProfileComparisonProps {
  profiles: Profile[];
  className?: string;
}

export function ProfileComparison({
  profiles,
  className,
}: ProfileComparisonProps) {
  const profilesWithMetrics = profiles.filter(
    (p) => p.metrics && p.metrics.total_runs > 0,
  );

  if (profilesWithMetrics.length === 0) {
    return null;
  }

  // Find best performers
  const bestSuccess = profilesWithMetrics.reduce((best, p) =>
    (p.metrics?.success_rate ?? 0) > (best.metrics?.success_rate ?? 0)
      ? p
      : best,
  );
  const fastestProfile = profilesWithMetrics.reduce((best, p) =>
    (p.metrics?.avg_duration_ms ?? Number.POSITIVE_INFINITY) <
    (best.metrics?.avg_duration_ms ?? Number.POSITIVE_INFINITY)
      ? p
      : best,
  );

  return (
    <div className={`rounded-lg border border-border p-4 ${className ?? ""}`}>
      <h4 className="mb-3 font-medium text-sm">Profile Performance</h4>
      <div className="space-y-3">
        {profilesWithMetrics.map((profile) => {
          const isBestSuccess = profile.id === bestSuccess.id;
          const isFastest = profile.id === fastestProfile.id;

          return (
            <div
              key={profile.id}
              className="flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{profile.name}</span>
                {isBestSuccess && (
                  <Badge className="border border-[var(--surface-success-border)] bg-[var(--surface-success-bg)] text-[var(--surface-success-text)] text-xs">
                    Best Success
                  </Badge>
                )}
                {isFastest && !isBestSuccess && (
                  <Badge className="border border-[var(--surface-info-border)] bg-[var(--surface-info-bg)] text-[var(--surface-info-text)] text-xs">
                    Fastest
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span>
                  <span className="text-muted-foreground">Success:</span>{" "}
                  <span
                    className={
                      (profile.metrics?.success_rate ?? 0) >= 80
                        ? "text-[var(--surface-success-text)]"
                        : (profile.metrics?.success_rate ?? 0) >= 50
                          ? "text-[var(--surface-warning-text)]"
                          : "text-[var(--surface-danger-text)]"
                    }
                  >
                    {profile.metrics?.success_rate.toFixed(0)}%
                  </span>
                </span>
                <span>
                  <span className="text-muted-foreground">Avg:</span>{" "}
                  {((profile.metrics?.avg_duration_ms ?? 0) / 1000).toFixed(1)}s
                </span>
                <span className="text-muted-foreground">
                  {profile.metrics?.total_runs} runs
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
