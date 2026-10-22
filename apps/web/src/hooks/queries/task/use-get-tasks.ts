import { useEffect, useRef, useState } from "react";
import { markBoardCacheChanged } from "@/lib/board-cache-version";
import {
  getBoardServerFilters,
  setBoardServerFilters,
} from "@/lib/board-server-filters";
import {
  serializeServerFilters,
  type TaskServerFilters,
} from "@/lib/task-filters/server-filters";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import getTasks from "@/fetchers/task/get-tasks";

export function useGetTasks(
  projectId: string,
  {
    refetchOnMount = true,
    serverFilters,
  }: {
    refetchOnMount?: boolean;
    // Pegasus fork (PEGA-89): board only. `null` means "no server filter";
    // `undefined` leaves whatever the board registered untouched.
    serverFilters?: TaskServerFilters | null;
  } = {},
) {
  const queryClient = useQueryClient();
  const managesFilters = serverFilters !== undefined;
  const serialized = managesFilters
    ? serializeServerFilters(serverFilters)
    : "";
  // Written during render so the fetch this render triggers already uses it.
  const registered = useRef<string | undefined>(undefined);
  if (managesFilters && registered.current !== serialized) {
    registered.current = serialized;
    setBoardServerFilters(queryClient, projectId, serverFilters ?? null);
  }
  const applied = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!managesFilters) return;
    const previous = applied.current;
    applied.current = serialized;
    // The first run fetches anyway (mount); only changes need a refetch.
    if (previous === undefined || previous === serialized) return;
    markBoardCacheChanged(queryClient, projectId);
    void queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
  }, [managesFilters, serialized, projectId, queryClient]);
  useEffect(() => {
    if (!managesFilters) return;
    return () => {
      const hadFilters = applied.current !== "";
      applied.current = undefined;
      registered.current = undefined;
      setBoardServerFilters(queryClient, projectId, null);
      // Other views read the same key and expect the whole board.
      if (hadFilters)
        void queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
    };
  }, [managesFilters, projectId, queryClient]);
  const [progress, setProgress] =
    useState<Awaited<ReturnType<typeof getTasks>>>();
  const query = useQuery({
    queryKey: ["tasks", projectId],
    queryFn: async ({ signal }) => {
      setProgress(undefined);
      markBoardCacheChanged(queryClient, projectId);
      const hasCachedBoard = !!queryClient.getQueryData(["tasks", projectId]);
      let invalidated = false;
      const unsubscribe = hasCachedBoard
        ? () => {}
        : queryClient.getQueryCache().subscribe((event) => {
            if (
              event.query.queryKey[0] !== "tasks" ||
              event.query.queryKey[1] !== projectId
            )
              return;
            if (event.type === "updated" && event.action.type === "invalidate")
              invalidated = true;
            if (
              event.type === "removed" ||
              (event.type === "updated" &&
                event.query.state.fetchStatus === "idle")
            ) {
              unsubscribe();
              if (
                invalidated &&
                !signal.aborted &&
                event.type === "updated" &&
                event.action.type === "success"
              ) {
                queueMicrotask(() => {
                  if (
                    signal.aborted ||
                    !queryClient.getQueryData(["tasks", projectId])
                  )
                    return;
                  void queryClient.invalidateQueries({
                    queryKey: ["tasks", projectId],
                  });
                });
              }
            }
          });
      try {
        return await getTasks(
          projectId,
          signal,
          (board) => {
            if (!hasCachedBoard) setProgress(board);
          },
          getBoardServerFilters(queryClient, projectId),
        );
      } catch (error) {
        unsubscribe();
        throw error;
      } finally {
        setProgress(undefined);
      }
    },
    refetchOnMount,
    refetchOnWindowFocus: true,
    enabled: !!projectId,
  });
  return {
    ...query,
    data: query.data ?? (query.isFetching ? progress : undefined),
  };
}
