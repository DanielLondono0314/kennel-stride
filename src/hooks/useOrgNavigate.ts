import { useNavigate, useParams, type NavigateOptions } from "react-router-dom";
import { useCallback } from "react";

/**
 * Returns a navigate function that prepends the current org slug.
 * Usage: const navigate = useOrgNavigate(); navigate("/customers");
 */
export function useOrgNavigate() {
  const navigate = useNavigate();
  const { orgSlug } = useParams<{ orgSlug: string }>();

  return useCallback(
    (path: string, options?: NavigateOptions) => {
      navigate(`/${orgSlug}${path}`, options);
    },
    [navigate, orgSlug]
  );
}

/** Returns the base path for the current org: "/<slug>" */
export function useOrgBasePath() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  return `/${orgSlug}`;
}
