export function getCanonicalUid(user) {
  // Canonical = provider uid (fallbacks help during auth init)
  const providerUid = user?.providerData?.[0]?.uid;
  const sessionUid = sessionStorage.getItem('uid');
  const authUid = user?.uid;

  return providerUid || sessionUid || authUid || '';
}