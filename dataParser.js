const csvParse = require('csv-parse/lib/sync');

function parseScheduleCSV(csvText) {
    const records = csvParse(csvText, {
        columns: true,
        skip_empty_lines: true
    });
 
    return records.map(r => ({
        route: r.route,
        stop: r.stop,
        lat: parseFloat(r.lat),
        lon: parseFloat(r.lon),
        time: r.time 
    }));
}

function parseGlonassData(jsonText) {
    try {
        const data = JSON.parse(jsonText);
    
        return data.map(item => ({
            route: item.route,
            lat: item.lat,
            lon: item.lon,
            timestamp: item.timestamp
        }));
    } catch (err) {
        console.error('Failed to parse GLONASS data:', err);
        return [];
    }
}

module.exports = {
    parseScheduleCSV,
    parseGlonassData
};
