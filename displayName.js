export default function displayName(Component, wrap) {
  const cName = Component.displayName || Component.name || 'Component';
  return wrap ? `${wrap}(${cName})` : cName;
}