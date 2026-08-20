// Only the main (env-based) admin may pass — event admins are blocked even
// though they're logged in, since actions gated by this (deleting records,
// creating events, managing event admins, exporting the full events list)
// are reserved for the main admin per the role spec.
module.exports = function requireMainAdmin(req, res, next) {
  if (!(req.session && req.session.isAdmin)) {
    return res.redirect(`/admin/login?next=${encodeURIComponent(req.originalUrl)}`);
  }
  if (req.session.adminRole !== 'main') {
    return res.status(403).render('404', { message: 'આ ક્રિયા ફક્ત મુખ્ય એડમિન જ કરી શકે છે.' });
  }
  return next();
};
