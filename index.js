const { Bot } = require('gotgbot');
const fs = require('fs');
const path = require('path');
const { parseScheduleCSV, parseGlonassData } = require('./dataParser');
const { calculateDistance, calculateWalkingTime, calculateBusETA } = require('./utils');
const config = require('./config');

const bot = new Bot(config.telegramToken);

const userData = {};


let schedules = [];
let glonassPositions = [];

function loadMockData() {
    const schedulePath = path.join(__dirname, 'mock_data', 'schedule.csv');
    const glonassPath = path.join(__dirname, 'mock_data', 'glonass.json');

    if (fs.existsSync(schedulePath)) {
        schedules = parseScheduleCSV(fs.readFileSync(schedulePath, 'utf-8'));
    } else {
        console.warn('Schedule CSV file not found.');
    }

    if (fs.existsSync(glonassPath)) {
        glonassPositions = parseGlonassData(fs.readFileSync(glonassPath, 'utf-8'));
    } else {
        console.warn('GLONASS data file not found.');
    }
}


bot.command('start', (ctx) => {
    ctx.reply('Добро пожаловать! Используйте /routes для выбора маршрута.');
});


bot.command('routes', (ctx) => {
    if (schedules.length === 0) {
        ctx.reply('Данные о расписании недоступны.');
        return;
    }
    const routes = [...new Set(schedules.map(s => s.route))];
    const routesList = routes.map((r, i) => `${i + 1}. ${r}`).join('\n');
    ctx.reply(`Доступные маршруты:\n${routesList}\n\nВыберите маршрут, отправив /route <номер>`);
});


bot.command('route', (ctx) => {
    const args = ctx.text.split(' ');
    if (args.length < 2) {
        ctx.reply('Пожалуйста, укажите номер маршрута. Например: /route 1');
        return;
    }
    const routeIndex = parseInt(args[1], 10) - 1;
    const routes = [...new Set(schedules.map(s => s.route))];
    if (routeIndex < 0 || routeIndex >= routes.length) {
        ctx.reply('Неверный номер маршрута.');
        return;
    }
    const selectedRoute = routes[routeIndex];
    userData[ctx.from.id] = { route: selectedRoute, stops: [], preferences: {} };
    const stops = schedules.filter(s => s.route === selectedRoute).map(s => s.stop);
    const uniqueStops = [...new Set(stops)];
    const stopsList = uniqueStops.map((stop, i) => `${i + 1}. ${stop}`).join('\n');
    ctx.reply(`Выбран маршрут: ${selectedRoute}\nДоступные остановки:\n${stopsList}\n\nВыберите остановку, отправив /stop <номер>`);
});


bot.command('stop', (ctx) => {
    const args = ctx.text.split(' ');
    if (args.length < 2) {
        ctx.reply('Пожалуйста, укажите номер остановки. Например: /stop 1');
        return;
    }
    const user = userData[ctx.from.id];
    if (!user || !user.route) {
        ctx.reply('Сначала выберите маршрут с помощью /routes и /route.');
        return;
    }
    const stops = schedules.filter(s => s.route === user.route).map(s => s.stop);
    const uniqueStops = [...new Set(stops)];
    const stopIndex = parseInt(args[1], 10) - 1;
    if (stopIndex < 0 || stopIndex >= uniqueStops.length) {
        ctx.reply('Неверный номер остановки.');
        return;
    }
    user.stop = uniqueStops[stopIndex];
    ctx.reply(`Вы выбрали остановку: ${user.stop}\nОтправьте свою геолокацию, чтобы рассчитать время выхода.`);
});


bot.on('message', (ctx) => {
    if (ctx.message.location) {
        const user = userData[ctx.from.id];
        if (!user || !user.route || !user.stop) {
            ctx.reply('Пожалуйста, сначала выберите маршрут и остановку с помощью /routes, /route и /stop.');
            return;
        }
        const userLocation = ctx.message.location;
        user.location = userLocation;


        const stopData = schedules.find(s => s.route === user.route && s.stop === user.stop);
        if (!stopData) {
            ctx.reply('Данные по остановке не найдены.');
            return;
        }
        const stopCoords = { lat: stopData.lat, lon: stopData.lon };
        const distanceToStop = calculateDistance(userLocation.latitude, userLocation.longitude, stopCoords.lat, stopCoords.lon);

        const walkingSpeed = user.preferences.walkingSpeed || 5;
        const walkingTimeMinutes = calculateWalkingTime(distanceToStop, walkingSpeed);

        const busETA = calculateBusETA(user.route, user.stop, glonassPositions, schedules);

       
        const leaveTimeMinutes = busETA - walkingTimeMinutes;

        ctx.reply(`Расстояние до остановки: ${distanceToStop.toFixed(2)} км\n` +
            `Время ходьбы: ${walkingTimeMinutes.toFixed(1)} мин\n` +
            `Автобус прибудет через: ${busETA.toFixed(1)} мин\n` +
            `Вам нужно выйти через: ${leaveTimeMinutes.toFixed(1)} мин`);

       
    }
});

bot.start();
console.log('Telegram bus schedule bot started.');
