import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve all static files (index.html, pages/*.html, assets, recursos, etc.)
app.use(express.static(__dirname, { extensions: ['html', 'htm'] }));

// Pages routes for clean URLs (e.g. /actualizaciones -> pages/actualizaciones.html)
const pages = [
  'actualizaciones',
  'betatester',
  'dashboard',
  'donaciones',
  'foro',
  'imagenes',
  'meinteresa',
  'nuestra-tierra',
  'perfil',
  'personal',
  'preregistro',
  'proyecto',
  'soporte',
  'videos'
];

app.get(['/minijuegos', '/pages/minijuegos.html'], (req, res) => {
  res.redirect(301, '/');
});

pages.forEach(page => {
  app.get(`/${page}`, (req, res) => {
    const htmlPath = path.join(__dirname, 'pages', `${page}.html`);
    if (fs.existsSync(htmlPath)) {
      res.sendFile(htmlPath);
    } else {
      res.render(`pages/${page}`);
    }
  });
});

// Wiki routes
app.get('/wiki', (req, res) => {
  const wikiHtml = path.join(__dirname, 'pages', 'wiki.html');
  if (fs.existsSync(wikiHtml)) {
    res.sendFile(wikiHtml);
  } else {
    res.redirect('/pages/wiki/como-comenzar.html');
  }
});

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
  app.get(`/wiki/${page}`, (req, res) => {
    const wikiPagePath = path.join(__dirname, 'pages', 'wiki', `${page}.html`);
    if (fs.existsSync(wikiPagePath)) {
      res.sendFile(wikiPagePath);
    } else {
      res.render(`wiki/${page}`);
    }
  });
});

// Admin routes
app.get('/admin', (req, res) => {
  const adminHtml = path.join(__dirname, 'pages', 'admin', 'admin.html');
  if (fs.existsSync(adminHtml)) {
    res.sendFile(adminHtml);
  } else {
    res.redirect('/pages/admin/admin.html');
  }
});

app.get('/admin/soporte', (req, res) => {
  const soporteAdminHtml = path.join(__dirname, 'pages', 'admin', 'soporte-admin.html');
  if (fs.existsSync(soporteAdminHtml)) {
    res.sendFile(soporteAdminHtml);
  } else {
    res.redirect('/pages/admin/soporte-admin.html');
  }
});

// Catch-all route fallback to index.html or 404
app.use((req, res) => {
  const indexHtml = path.join(__dirname, 'index.html');
  if (fs.existsSync(indexHtml)) {
    res.sendFile(indexHtml);
  } else {
    res.status(404).send('Página no encontrada');
  }
});

const ports = process.env.PORT ? [Number(process.env.PORT)] : [8080, 5000, 3000];

ports.forEach(port => {
  const server = app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`Port ${port} is in use, skipping...`);
    } else {
      console.error(`Error on port ${port}:`, err.message);
    }
  });
});

