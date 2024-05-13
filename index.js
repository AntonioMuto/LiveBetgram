const request = require('request');
const { DateTime, Duration } = require('luxon');
const dotenv = require('dotenv');
const cron = require('node-cron');
const axios = require('axios');
const zlib = require('zlib');
const { start } = require('repl');

const TOKEN = process.env.TOKEN;
dotenv.config();

var matchHashMap = {};
dataNow = DateTime.now();
var replace = true;
var keepLive = true;
var todayDay = DateTime.now().day;
var matchTimeStart = undefined;
var matchTimeEnd = undefined;
var countLive = 0;
var newMargingSelected = false;

var latest = DateTime.now();
fetchRangeTime()

cron.schedule('*/10 * * * * *', () => {
    console.log(matchTimeStart, keepLive)
    if (DateTime.now() > matchTimeStart && keepLive) {
        newMargingSelected = false;
        updateLive(0).then(() => {
            if (Object.keys(matchHashMap).length !== 0) {
                latest = DateTime.now();
                saveData(matchHashMap);
                updateTimestampLastCall();
            }
            differenceArray = [];
            diffSize = false;
        }).catch((error) => {
            console.error('Errore nell\'aggiornamento dei dati:', error);
        });
    } else {
        countLive = 0;
        console.log(newMargingSelected);
        if (newMargingSelected == false) {
            if (DateTime.now().day !== todayDay) {
                setRangeTime(0);
            } else {
                setRangeTime(1);
            }
        }
    }
}, {
    timezone: "Europe/Rome"
});


async function updateTimestampLastCall() {
    let urlTimestamp = process.env.TIMESTAMPURL;

    let dataTime = {
        log: DateTime.now()
    }

    const config = {
        headers: {
            'Content-Type': 'application/json',
        }
    };

    axios.put(urlTimestamp, dataTime, config)
        .then(response => {
        })
        .catch(error => {
        });
}

async function saveData(matchHashMap) {
    const url = process.env.LIVEURL;
    const jsonData = JSON.stringify(matchHashMap);

    zlib.gzip(jsonData, (err, gzipData) => {
        if (err) {
            console.error('Errore durante la compressione dei dati:', err);
            return;
        }

        const config = {
            headers: {
                'Content-Type': 'application/json',
                'Content-Encoding': 'gzip',
            }
        };

        axios.put(url, gzipData, config)
            .then(response => {
            })
            .catch(error => {
            });
    })
}

async function updateLive(dayPlus) {
    var end = false;
    matchHashMap = {};
    for (var i = 1; i < 20 && !end; i++) {
        await new Promise((resolve, reject) => {
            const url = `https://api.sportmonks.com/v3/football/fixtures/date/${DateTime.now().plus({ days: dayPlus }).toFormat('yyyy-MM-dd')}?api_token=${process.env.TOKEN}&include=round:name;league:id;coaches:common_name,image_path;coaches;league:id;participants;scores;venue:name,capacity,image_path,city_name;state;lineups.player:common_name,image_path;events;lineups.player:common_name,image_path;events;statistics:data,participant_id;periods;metadata;&filters=fixtureLeagues:384,387,564,462,72,82,301,8,2;MetaDataTypes:159,161,162;fixtureStatisticTypes:54,86,45,41,56,42,39,51,34,80,58,57&page=${i}&timezone=Europe/Rome`;
            request.get({ url }, (error, response, body) => {
                if (error) {
                    console.error('Errore nella richiesta HTTP:', error);
                    reject(error);
                } else {
                    const result = JSON.parse(response.body);
                    keepLive = false;
                    for (var match of result.data || []) {
                        matchHashMap[match.id] = refineResponse(match);
                        if (matchHashMap[match.id].state.id == 1 || matchHashMap[match.id].state.id == 2 || matchHashMap[match.id].state.id == 22 || matchHashMap[match.id].state.id == 3) {
                            keepLive = true;
                            countLive++;
                        }
                    }
                    if (result.pagination === undefined) {
                        end = true;
                    } else {
                        if (result.pagination.has_more == false) {
                            end = true;
                        }
                    }
                    resolve();
                }
            });
        });
    }

    return matchHashMap;
}


var endTime = false;

async function setRangeTime(dayPlus) {
    const formatoInput = "yyyy-MM-dd HH:mm:ss";
    var orarioInizio = DateTime.fromFormat(`${DateTime.now().plus({ days: dayPlus }).toFormat('yyyy-MM-dd')} 23:59:00`, formatoInput);
    var orarioFine = DateTime.fromFormat(`${DateTime.now().plus({ days: dayPlus }).toFormat('yyyy-MM-dd')} 00:00:00`, formatoInput);
    var nessunMatch = true;
    return new Promise((resolve, reject) => {
        (async () => {
            for (var i = 1; i < 20 && !endTime; i++) {
                await new Promise((resolve, reject) => {
                    const url = `https://api.sportmonks.com/v3/football/fixtures/date/${DateTime.now().plus({ days: dayPlus }).toFormat('yyyy-MM-dd')}?api_token=${process.env.TOKEN}&include=round:name;league:id;coaches:common_name,image_path;coaches;league:id;participants;scores;venue:name,capacity,image_path,city_name;state;lineups.player:common_name,image_path;events;comments;lineups.player:common_name,image_path;events;comments;statistics:data,participant_id;periods:time_added;metadata;&filters=fixtureLeagues:384,387,564,462,72,82,301,8,2;MetaDataTypes:159,161,162;fixtureStatisticTypes:54,86,45,41,56,42,39,51,34,80,58,57&page=${i}&timezone=Europe/Rome`;
                    request.get({ url }, (error, response, body) => {
                        if (error) {
                            console.error('Errore nella richiesta HTTP:', error);
                            reject(error);
                        } else {
                            const result = JSON.parse(response.body);
                            for (var match of result.data || []) {
                                nessunMatch = false;
                                const dataLuxon = DateTime.fromFormat(match.starting_at, formatoInput);

                                if (dataLuxon.isValid) {
                                    if (!orarioFine || dataLuxon > orarioFine) {
                                        orarioFine = dataLuxon;
                                    }
                                    if (!orarioInizio || dataLuxon < orarioInizio) {
                                        orarioInizio = dataLuxon;
                                    }
                                }
                            }
                            if (result.pagination === undefined) {
                                endTime = true;
                            } else {
                                if (result.pagination.has_more == false) {
                                    endTime = true;
                                }
                            }
                            resolve();
                        }
                    });
                });
            }
        })().then(() => {
            const url = process.env.RANGEURL;
            let jsonData = { "match": "NESSUNO" };
            orarioFine = orarioFine.plus({ hours: 2, minutes: 20 });
            if (nessunMatch === false) {
                jsonData = { "start": orarioInizio, "end": orarioFine };
            }
            const config = {
                headers: {
                    'Content-Type': 'application/json'
                }
            };
            axios.put(url, jsonData, config)
                .then(response => {
                    keepLive = true;
                    newMargingSelected = true;
                    let dayCheck = 0;
                    dayPlus == 0 ? dayCheck = 1 : dayCheck = 0;
                    const updMatchUrl = `http://${process.env.APIBETGRAM}/api/insert/match/${DateTime.now().minus({ days: dayCheck }).toFormat('yyyy-MM-dd')}`;
                    axios.get(updMatchUrl)
                        .then((response) => {
                            updateLive(dayPlus).then(() => {
                                if (Object.keys(matchHashMap).length !== 0) {
                                    saveData(matchHashMap);
                                }
                                differenceArray = [];
                                diffSize = false;
                            })
                                .catch((error) => {
                                    console.error('Errore nell\'aggiornamento dei dati:', error);
                                });
                        }).catch((error) => {
                            console.error('Errore nell\'aggiornamento dei dati:', error);
                        });
                })
                .catch(error => {
                    console.error('ERRORE');
                });
        });
    });
}


function refineResponse(match) {
    match.venue = undefined;
    match.league = undefined;
    match.sport_id = undefined;
    match.stage_id = undefined;
    match.group_id = undefined;
    match.aggregate_id = undefined;
    match.state_id = undefined;
    match.name = undefined;
    match.result_info = undefined;
    match.leg = undefined;
    match.details = undefined;
    match.length = undefined;
    match.placeholder = undefined;
    match.has_odds = undefined;
    match.starting_at_timestamp = undefined;
    match.round.id = undefined;

    //ROUND
    match.round.sport_id = undefined;
    match.round.league_id = undefined;
    match.round.season_id = undefined;
    match.round.stage_id = undefined;

    //COACHES
    for (let i = 0; i < match.coaches.length; i++) {
        match.coaches[i].player_id = undefined;
        match.coaches[i].sport_id = undefined;
        match.coaches[i].country_id = undefined;
        match.coaches[i].meta = undefined;
    }

    for (let i = 0; i < match.participants.length; i++) {
        match.participants[i].venue_id = undefined;
        match.participants[i].sport_id = undefined;
        match.participants[i].country_id = undefined;
        match.participants[i].gender = undefined;
        match.participants[i].founded = undefined;
        match.participants[i].type = undefined;
        match.participants[i].placeholder = undefined;
        match.participants[i].last_played_at = undefined;
    }

    for (let i = 0; i < match.scores.length; i++) {
        match.scores[i].fixture_id = undefined;
        match.scores[i].id = undefined;
    }

    match.state.state = undefined;
    match.state.name = undefined;
    match.state.short_name = undefined;

    for (let i = 0; i < match.lineups.length; i++) {
        match.lineups[i].id = undefined;
        match.lineups[i].sport_id = undefined;
        match.lineups[i].fixture_id = undefined;
        match.lineups[i].id = undefined;
        if (match.lineups[i].player != null) {
            match.lineups[i].player.country_id = undefined;
            match.lineups[i].player.sport_id = undefined;
            match.lineups[i].player.city_id = undefined;
        }
    }

    for (let i = 0; i < match.events.length; i++) {
        match.events[i].fixture_id = undefined;
        match.events[i].period_id = undefined;
        match.events[i].section = undefined;
        match.events[i].section = undefined;
    }

    for (let i = 0; i < match.statistics.length; i++) {
        match.statistics[i].fixture_id = undefined;
    }

    for (let i = 0; i < match.periods.length; i++) {
        match.periods[i].fixture_id = undefined;
        match.periods[i].started = undefined;
        match.periods[i].id = undefined;
        match.periods[i].ended = undefined;
        match.periods[i].counts_from = undefined;
        match.periods[i].ticking = undefined;
        match.periods[i].has_timer = undefined;
    }

    for (let i = 0; i < match.metadata.length; i++) {
        match.metadata[i].metadatable_id = undefined;
        match.metadata[i].id = undefined;
    }

    return match;
}






async function fetchRangeTime() {
    await new Promise((resolve, reject) => {
        const url = process.env.RANGEURL;
        request.get({ url }, (error, response, body) => {
            if (error) {
                console.error('Errore nella richiesta HTTP:', error);
                reject(error);
            } else {
                const result = JSON.parse(response.body);
                matchTimeStart = DateTime.fromISO(result.start);
                matchTimeEnd = DateTime.fromISO(result.end);
                resolve();
            }
        });
    });
}

