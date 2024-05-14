// app.js

const express = require('express');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const flash = require('express-flash');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database connection pool
const pool = mysql.createPool({
  host: 'localhost',
  user: 'admin',
  password: 'root',
  database: 'userdb',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Express session middleware
app.use(session({
  secret: 'secret', // Change this to a long, randomly generated string
  resave: false,
  saveUninitialized: false
}));

// Flash middleware
app.use(flash());

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// EJS setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));

// Passport local strategy
passport.use(new LocalStrategy(
  async (username, password, done) => {
    let connection;
    try {
      connection = await pool.getConnection();
      // Fetch user from the database
      const [rows] = await connection.execute('SELECT * FROM users WHERE username = ?', [username]);
      const user = rows[0];

      // If user doesn't exist, return error
      if (!user) {
        return done(null, false, { message: 'Incorrect username.' });
      }

      // Compare password
      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        return done(null, false, { message: 'Incorrect password.' });
      }

      // If all is good, return user
      return done(null, user);
    } catch (err) {
      return done(err);
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }
));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.execute('SELECT * FROM users WHERE id = ?', [id]);
    const user = rows[0];
    done(null, user);
  } catch (err) {
    done(err);
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// Routes
app.get('/', (req, res) => {
  res.render('index', { message: req.flash('error') });
});

app.post('/login', passport.authenticate('local', {
  successRedirect: '/chatbot',
  failureRedirect: '/',
  failureFlash: true,
}));

app.post('/signup', async (req, res) => {
  const { username, password, confirmPassword } = req.body;

  if (password !== confirmPassword) {
    req.flash('error', 'Passwords do not match.');
    res.redirect('/');
    return;
  }

  let connection;
  try {
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Get a connection from the pool
    connection = await pool.getConnection();

    // Insert user into database
    const [result] = await connection.execute('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword]);

    // Check if insertion was successful
    if (result.affectedRows === 1) {
      res.redirect('/chatbot');
    } else {
      req.flash('error', 'Error signing up. Please try again.');
      res.redirect('/');
    }
  } catch (err) {
    console.error(err); // Log the error to the console
    req.flash('error', 'Error signing up. Please try again.');
    res.redirect('/'); // Redirect to signup/login page
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// Chatbot route
app.get('/chatbot', (req, res) => {
  res.render('chat', { username: req.user.username });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
