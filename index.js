const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const multer = require('multer');
const cors = require('cors');
const casual = require('casual');
const path = require('path');
const secretKey = 'xJ@4kT#e*6Pb&8QvLm9GpZr6Jw8Xz2Rv';
require('dotenv').config();

const app = express();
const port = process.env.PORT;
app.use(cors());
app.use(bodyParser.json());

// MongoDB connection setup
mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection;

db.on('error', (error) => {
  console.error('MongoDB connection error:', error);
});

db.once('open', () => {
  console.log('MongoDB connected successfully');
});

// User schema and model
const userSchema = new mongoose.Schema({
  email: String,
  password: String,
});

const User = mongoose.model('users', userSchema);

// Blog post schema and model
const blogPostSchema = new mongoose.Schema({
  title: String,
  content: String,
  imageData: Buffer,
});

const BlogPost = mongoose.model('blogposts', blogPostSchema);

// Multer storage configuration
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Middleware for authentication
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (token == null) return res.sendStatus(401);

  jwt.verify(token, secretKey , (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Serve the HTML page when accessing the root URL
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// User registration
app.post('/register', async (req, res) => {
  try {
    // Check if the email is already registered
    const existingUser = await User.findOne({ email: req.body.email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email is already registered.' });
    }

    // Hash the password and create a new user
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const user = new User({ email: req.body.email, password: hashedPassword });
    await user.save();
    res.status(201).json({ message: 'Registration successful.' });
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

// User login
app.post('/login', async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (user == null) {
    return res.sendStatus(400);
  }

  try {
    if (await bcrypt.compare(req.body.password, user.password)) {
      const accessToken = jwt.sign({ email: user.email }, secretKey);
      res.json({ accessToken: accessToken });
    } else {
      res.sendStatus(401);
    }
  } catch {
    res.sendStatus(500);
  }
});

// Endpoint to fetch sample blog post data
app.get('/sample-blog-posts', (req, res) => {
  try {
    // Generate sample blog post data using casual
    const sampleBlogPosts = Array.from({ length: 5 }, () => ({
      title: casual.title,
      content: casual.text,
    }));

    res.json(sampleBlogPosts);
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

// Create blog post with image upload
app.post('/blog', upload.single('image'), async (req, res) => {
  const { title, content } = req.body;

  try {
    const newBlogPost = new BlogPost({
      title,
      content,
      imageData: req.file.buffer,
    });

    await newBlogPost.save();

    res.status(201).json({ message: 'Blog post with image saved successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Get all blog posts
app.get('/blog', async (req, res) => {
  try {
    const blogPosts = await BlogPost.find();
    res.json(blogPosts);
  } catch {
    res.sendStatus(500);
  }
});

// Update blog post
app.put('/blog/:id',authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { title, content } = req.body;

    // Check if imageData is present in the request
    const updatedData = {
      title,
      content,
      ...(req.file && { imageData: req.file.buffer }), // Only update imageData if a file is provided
    };

    await BlogPost.findByIdAndUpdate(req.params.id, { $set: updatedData });
    res.sendStatus(200);
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});


// Delete blog post
app.delete('/blog/:id', authenticateToken, async (req, res) => {
  try {
    await BlogPost.findByIdAndDelete(req.params.id);
    res.sendStatus(200);
  } catch {
    res.sendStatus(500);
  }
});

// Search blog posts by title
app.get('/blog/search', async (req, res) => {
  try {
    const searchTerm = req.query.title;
    const regex = new RegExp(searchTerm, 'i');
    const blogPosts = await BlogPost.find({ title: regex });
    res.json(blogPosts);
  } catch {
    res.sendStatus(500);
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
