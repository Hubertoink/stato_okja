export type ActivityEditorNavigationState = {
  from?: string;
  activityListKey?: string;
  returnState?: { from?: string; activityListKey?: string };
};

export function getActivityEditorReturn(state: ActivityEditorNavigationState | null, deleted = false) {
  const returnState = state?.returnState;
  return {
    to: (deleted && returnState ? returnState.from : state?.from) || '/activities',
    state: deleted
      ? { activityListKey: returnState?.activityListKey || state?.activityListKey }
      : returnState || { activityListKey: state?.activityListKey },
  };
}
