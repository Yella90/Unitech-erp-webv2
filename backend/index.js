require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const auclassesRoutes = require('./routes/classes');
const elevesRoutes = require('./routes/eleves');
const enseignantsRoutes = require('./routes/enseignants');
const personnelsRoute= require('./routes/personnel')
const matiereRoute = require('./routes/matiereRoute');
const financesRoute = require('./routes/finances');
const affectationRoute=require('./routes/affectationRoute')
const administrateurRoute = require('./routes/administrateur');
const systemRoute = require('./routes/system');
const superadminRoute = require('./routes/superadmin');
const systemController = require('./controllers/systemController');
const activityLogger = require('./middleware/activityLogger');
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', activityLogger);

app.use('/api/auth', authRoutes);
app.use('/api/classes', auclassesRoutes);
app.use('/api/eleves', elevesRoutes);
app.use('/api/enseignants', enseignantsRoutes); 
app.use('/api/personnels',personnelsRoute);
app.use('/api/matieres', matiereRoute);
app.use('/api/finances', financesRoute);
app.use('/api/affectation',affectationRoute)
app.use('/api/administrateur', administrateurRoute);
app.use('/api/system', systemRoute);
app.use('/api/superadmin', superadminRoute);
app.get('/api/public/bulletins/:id', systemController.verifyBulletinPublic);
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Serveur accessible sur http://votre-ip:${PORT}`);
});
