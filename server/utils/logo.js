// Node v24 includes fetch globally.

exports.getLogoByName = async (name) => {
  if (!name) return null;
  try {
    const url = `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(name)}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      // Find exact match or just take first
      const exactMatch = data.find(c => c.name.toLowerCase() === name.toLowerCase());
      return exactMatch ? exactMatch.logo : data[0].logo;
    }
  } catch (err) {
    console.error('Clearbit logo error:', err.message);
  }
  return null;
}
