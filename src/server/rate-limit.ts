export function shouldAllowRequest(input: {
  key: string;
  now: number;
  history: number[];
  limit: number;
}) {
  const allowed = input.history.length < input.limit;
  return {
    allowed,
    key: input.key,
    checkedAt: input.now
  };
}
