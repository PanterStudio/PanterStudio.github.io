import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static assets
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/recursos', express.static(path.join(__dirname, 'recursos')));

// Main index route
app.get('/', (req, res) => res.render('index'));

// Pages routes
const pages = [
  'actualizaciones',
  'betatester',
  'dashboard',
  'donaciones',
  'imagenes',
  'meinteresa',
  'minijuegos',
  'perfil',
  'personal',
  'preregistro',
  'proyecto',
  'videos'
];

pages.forEach(page => {
  app.get(`/${page}`, (req, res) => res.render(`pages/${page}`));
});

// Wiki redirect and sub-pages
app.get('/wiki', (req, res) => res.redirect('/wiki/como-comenzar'));

const wikiPages = [
  'como-comenzar',
  'dispositivo-movil',
  'faq',
  'mecanicas',
  'mensajero',
  'trabajos',
  'vehiculos',
  'mapas'
];

wikiPages.forEach(page => {
  app.get(`/wiki/${page}`, (req, res) => res.render(`wiki/${page}`));
});

// Catch-all route to redirect back to home or show 404
app.use((req, res) => {
  res.status(404).render('pages/proyecto'); // Re-using a simple design or redirect
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
