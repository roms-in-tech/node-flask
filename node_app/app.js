const express = require('express');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const flash = require('express-flash');
const path = require('path');
const client = require('prom-client');
const usersRouter = require('./routes/users');
const winston = require('winston');
const LokiTransport = require('winston-loki');

const app = express();
const PORT = process.env.PORT || 9000;

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new LokiTransport({
      host: 'http://10.0.1.140:3100',
      labels: { job: 'nodejs-app' }
    }),
    new winston.transports.File({ filename: 'logs/app.log' }) // Save logs to a file
  ],
});

logger.info('Logger initialized');

// Initialize database connection pool
const pool = mysql.createPool({
  host: 'zoeencloud-rds.c5d2abh4bx8o.ap-south-1.rds.amazonaws.com',
  user: 'admin',
  password: 'root',
  database: 'userdb',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

logger.info('Database connection pool initialized');

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
        logger.warn(`Login failed for username: ${username} - User not found`);
        return done(null, false, { message: 'Incorrect username.' });
      }

      // Compare password
      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        logger.warn(`Login failed for username: ${username} - Incorrect password`);
        return done(null, false, { message: 'Incorrect password.' });
      }

      // If all is good, return user
      logger.info(`User ${username} logged in successfully`);
      return done(null, user);
    } catch (err) {
      logger.error('Error during authentication', err);
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
    logger.error('Error during deserialization', err);
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
  successRedirect: '/welcome',
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
      logger.info(`User ${username} signed up successfully`);
      res.redirect('/welcome');
    } else {
      req.flash('error', 'Error signing up. Please try again.');
      res.redirect('/');
    }
  } catch (err) {
    logger.error('Error during signup', err);
    req.flash('error', 'Error signing up. Please try again.');
    res.redirect('/');
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// Welcome route
app.get('/welcome', (req, res) => {
  if (req.isAuthenticated()) {
    res.render('welcome', { username: req.user.username });
  } else {
    res.redirect('/');
  }
});

// Start server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

// Create a Registry to register the metrics
const register = new client.Registry();
client.collectDefaultMetrics({ register });

// Prometheus metrics route
app.get('/metrics', async (req, res) => {
  const end = httpRequestTimer.startTimer();
  const route = req.route.path;

  res.setHeader('Content-Type', register.contentType);
  res.send(await register.metrics());

  end({ route, code: res.statusCode, method: req.method });
});
