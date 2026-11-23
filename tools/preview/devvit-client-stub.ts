// Stand-in for @devvit/web/client so the UI can be previewed outside Reddit.
export const requestExpandedMode = () => {};
export const navigateToPost = () => {};
export const showLoginPrompt = () => {};
export const showShareSheet = async () => {};
export const showToast = (text: unknown) => console.info('toast', text);
