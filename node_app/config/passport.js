const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');

const initialize = (passport, getUserByUsername) => {
  const authenticateUser = (username, password, done) => {
    getUserByUsername(username)
      .then((user) => {
        if (!user) {
          return done(null, false, { message: 'Incorrect username.' });
        }

        bcrypt.compare(password, user.password)
          .then((result) => {
            if (result) {
              return done(null, user);
            } else {
              return done(null, false, { message: 'Incorrect password.' });
            }
          })
          .catch((err) => {
            return done(err);
          });
      })
      .catch((err) => {
        return done(err);
      });
  };

  passport.use(new LocalStrategy({ usernameField: 'username' }, authenticateUser));
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });
  passport.deserializeUser((id, done) => {
    // Replace this with your own database query to get the user by id.
    const user = { id: id, username: 'test' };
    done(null, user);
  });
};

module.exports = initialize;