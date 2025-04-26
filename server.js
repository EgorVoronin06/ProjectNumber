const express = require('express');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const app = express();
const PORT = 3000;


let glonassData = [];
const csvFilePath = path.join(__dirname, 'ГЛОНАСС координаты транспорта.csv');

fs.createReadStream(csvFilePath)
  .pipe(csv())
  .on('data', (row) => {
    glonassData.push({
      transportId: row['ID транспорта'],
      route: row['Маршрут'],
      lat: parseFloat(row['Широта']),
      lon: parseFloat(row['Долгота']),
      timestamp: new Date(row['Время']),
      speed: parseFloat(row['Скорость']) || 0
    });
  })
  .on('end', () => {
    console.log(`Загружено ${glonassData.length} записей ГЛОНАСС`);
  });


app.get('/api/transport', (req, res) => {
  res.json(glonassData);
});

app.get('/api/transport/:route', (req, res) => {
  const route = req.params.route;
  const filtered = glonassData.filter(item => item.route === route);
  res.json(filtered);
});

app.get('/api/nearby', async (req, res) => {
  const { lat, lon, radius = 1000 } = req.query;
  
  if (!lat || !lon) {
    return res.status(400).json({ error: 'Необходимы параметры lat и lon' });
  }

  try {
    // Интеграция с фронтендом из репозитория
    const frontendResponse = await axios.get('http://localhost:8080/api/stops');
    const stops = frontendResponse.data;

    const nearbyTransports = glonassData.filter(transport => {
      const distance = calculateDistance(
        parseFloat(lat), 
        parseFloat(lon), 
        transport.lat, 
        transport.lon
      );
      return distance <= radius;
    });

    const nearbyStops = stops.filter(stop => {
      const distance = calculateDistance(
        parseFloat(lat), 
        parseFloat(lon), 
        stop.lat, 
        stop.lon
      );
      return distance <= radius;
    });

    res.json({
      transports: nearbyTransports,
      stops: nearbyStops,
      userLocation: { lat: parseFloat(lat), lon: parseFloat(lon) }
    });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка интеграции с фронтендом' });
  }
});

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c * 1000; 
}


app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});
