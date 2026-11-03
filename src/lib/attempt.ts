/** Run a database step, logging a failure, for the caller to answer with a retryable 500. */
export async function attempt<T>(
  step: () => Promise<T>,
  failure: string,
): Promise<T | undefined> {
  try {
    return await step()
  } catch (error) {
    console.error(failure, error)
    return undefined
  }
}
