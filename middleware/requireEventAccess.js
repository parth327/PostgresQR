// Scopes event-specific routes (event detail/export, check-in page, check-in
// API) to a single event for event admins. Must run after requireAdmin, so
// req.session.isAdmin is already guaranteed true here. The main admin always
// passes through untouched.
module.exports = function requireEventAccess(req, res, next) {
  if (req.session.adminRole !== 'event') return next();

  const requestedEventId = req.params.id || req.query.eventId || req.body.eventId;

  if (!requestedEventId) {
    // No event specified on a route that defaults to "today's event" for the
    // main admin — for an event admin, default to their own assigned event.
    if (req.method === 'GET') req.query.eventId = req.session.adminEventId;
    else req.body.eventId = req.session.adminEventId;
    return next();
  }

  if (requestedEventId !== req.session.adminEventId) {
    return res.status(403).render('404', { message: 'તમને આ ઇવેન્ટની ઍક્સેસ પરવાનગી નથી.' });
  }

  return next();
};
