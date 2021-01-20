module.exports.getUser = email =>
  USERS.get(email, 'json').then(u => {
    if (!u.active) {
      return {}
    }
    return u
  })
