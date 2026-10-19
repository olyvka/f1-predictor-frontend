// English. Plurals: _one / _other. Data from the dataset (retirement reasons, nationalities) is already English.
const en = {
  "app": {
    "title": "F1 Predictor",
    "back": "Back",
    "language": "Interface language"
  },
  "common": {
    "loadingPage": "Loading page…",
    "loading": "Loading…",
    "noData": "No data",
    "of": "of"
  },
  "countdown": {
    "now": "now",
    "days_one": "in {{count}} day",
    "days_other": "in {{count}} days",
    "hours_one": "in {{count}} hour",
    "hours_other": "in {{count}} hours",
    "minutes_one": "in {{count}} min",
    "minutes_other": "in {{count}} min"
  },
  "units": {
    "kph": "{{value}} km/h",
    "seconds": "{{value}}s",
    "laps_one": "{{count}} lap",
    "laps_other": "{{count}} laps",
    "mps": "{{value}} m/s",
    "mpsShort": "m/s",
    "secondsSpaced": "{{value}} s",
    "km": "{{value}} km",
    "d": "d",
    "h": "h",
    "m": "m",
    "s": "s"
  },
  "errors": {
    "timeout": "The request is taking too long (over {{minutes}} min). Try again — the next request will be faster (data is cached on the server).",
    "network": "Could not reach the server.",
    "http": "Request failed: {{status}}"
  },
  "trackStatus": {
    "1": "Clear",
    "2": "Yellow flags",
    "3": "SC (deployed)",
    "4": "Safety Car",
    "5": "Red flag",
    "6": "VSC",
    "7": "VSC (ending)",
    "unknown": "Code {{code}}"
  },
  "flags": {
    "yellow": "Yellow flags",
    "safetyCar": "Safety Car / VSC",
    "red": "Red flag"
  },
  "classified": {
    "R": "Retired",
    "D": "Disqualified",
    "W": "Withdrawn",
    "E": "Excluded",
    "N": "Not classified"
  },
  "loader": {
    "title": "Loading",
    "hint6": "The first request for this data can take longer — after that it is instant (cached on the server and in the browser).",
    "hint20": "This is taking longer than usual — the backend is still fetching data from an external source, still waiting.",
    "hint45": "This is a really long wait — the backend is still fetching external data. The request will stop on its own after 2 min, then you can retry."
  },
  "error": {
    "title": "Error",
    "retry": "Try again"
  },
  "nav": {
    "breadcrumb": "Breadcrumb"
  },
  "circuit": {
    "mapLabel": "{{name}} circuit map"
  },
  "form": {
    "round": "Round {{round}}: {{result}}",
    "dnf": "retired",
    "dsq": "disqualified"
  },
  "drivers": {
    "none": "No drivers for this session."
  },
  "chart": {
    "round": "Round",
    "roundN": "Round {{round}}",
    "lap": "Lap",
    "lapN": "Lap {{lap}}",
    "lapLower": "lap {{lap}}",
    "noLaps": "No laps to plot.",
    "noDelta": "Not enough data to compute the gap.",
    "noSpeed": "No speed data.",
    "noFeatures": "No feature importance data."
  },
  "tyres": {
    "noData": "no data"
  },
  "tabs": {
    "overview": "Overview",
    "prediction": "Prediction"
  },
  "session": {
    "notYet": "Not held yet"
  },
  "charts": {
    "pitStop": "pit stop",
    "pitStopDuration": "pit stop {{value}}s",
    "pitStopLegend": "Pit stop",
    "tyreAge": "Tyre age: {{laps}} laps",
    "tyreAgeAxis": "Tyre age (laps)",
    "stintN": "Stint {{stint}}",
    "noDegradation": "Not enough data for a degradation curve.",
    "driversCount_one": "{{count}} driver",
    "driversCount_other": "{{count}} drivers",
    "fieldMedian": "Field median",
    "fieldBest": "Field best lap",
    "stopN": "stop #{{stop}}",
    "noPitStops": "No pit stops.",
    "startToFinish": "Start P{{grid}} → Finish P{{position}}",
    "noChange": "no change",
    "positionsDelta_one": "{{sign}}{{count}} position",
    "positionsDelta_other": "{{sign}}{{count}} positions",
    "noGridData": "Not enough data (start and finish needed).",
    "start": "Start",
    "finish": "Finish",
    "noStintSpread": "Not enough laps per stint to show pace spread.",
    "best": "Best",
    "median": "Median",
    "worst": "Worst"
  },
  "weather": {
    "time": "Time {{time}}",
    "none": "No weather data.",
    "air": "Air",
    "track": "Track",
    "humidity": "Humidity",
    "wind": "Wind",
    "max": "Max {{value}}",
    "temperature": "Temperature (°C)",
    "rainShaded": "rain shaded",
    "humidityAxis": "Humidity (%)",
    "windAxis": "Wind (m/s)",
    "windSpeed": "Wind speed",
    "fieldPace": "Field median pace",
    "comparePace": "compare with the weather above"
  },
  "laps": {
    "none": "No laps.",
    "driver": "Driver",
    "lap": "Lap",
    "time": "Time",
    "tyre": "Tyre",
    "tyreLife": "Age",
    "position": "Pos.",
    "trackStatus": "Track status",
    "deleted": "Lap deleted",
    "used": "used",
    "prev": "Previous",
    "next": "Next"
  },
  "summary": {
    "title": "Race summary",
    "sprint": "Sprint",
    "pole": "Pole",
    "startedFirst": "started first",
    "fastestLap": "Fastest lap",
    "hero": "Biggest gainer",
    "dnfs": "Retirements",
    "allFinished": "everyone finished",
    "fromTo": "P{{grid}} to P{{position}}",
    "fromPitLane": "pit lane to P{{position}}"
  },
  "history": {
    "title": "Circuit history",
    "gpsHere": "Grands Prix here",
    "firstIn": "first in {{year}}",
    "poleWin": "Won from pole",
    "poleWinHint": "Share of races won by the driver who started first",
    "lastN": "last {{count}}",
    "allTime": "{{value}} all time",
    "mostWins": "Most wins",
    "lastWin": "last in {{year}}",
    "recentWinners": "Recent winners",
    "grid": "Grid position",
    "fromGrid": "from P{{grid}}",
    "fromPitLane": "from pit lane"
  },
  "circuitCard": {
    "title": "Circuit",
    "lapLength": "Lap length",
    "raceLaps": "Race laps",
    "distance": "distance ≈ {{value}} km",
    "corners": "Corners",
    "pitLoss": "Pit stop time loss",
    "pitLossSc": "under SC {{sc}} · VSC {{vsc}}",
    "stopsPerDriver": "Pit stops per driver",
    "avgOver_one": "average over {{count}} race",
    "avgOver_other": "average over {{count}} races",
    "fastestPitLane": "Fastest pit lane transit"
  },
  "standings": {
    "up": "Up {{count}}",
    "down": "Down {{count}}",
    "beforeRound": "Standings before the round",
    "afterRound": "Standings after the round",
    "fullTable": "Full table",
    "asOf": "as of round {{round}}"
  },
  "season": {
    "tabDrivers": "Drivers",
    "tabTeams": "Teams",
    "tabCalendar": "Calendar",
    "title": "Season",
    "titleYear": "{{year}} season",
    "loadingStandings": "Loading the {{year}} standings…",
    "noRacesYet": "No races have been held this season yet.",
    "loadingCalendar": "Loading the {{year}} calendar…",
    "search": "Search by name, city, country…",
    "searchLabel": "Search rounds"
  },
  "predictionCheck": {
    "title": "Model prediction",
    "compute": "Compute",
    "notReady": "No prediction has been computed for this round yet. The first run trains the model and can take a few minutes.",
    "podiumTitle": "Model podium prediction",
    "details": "Details",
    "hits": "predicted drivers finished in the top 3",
    "actual": "Actual position",
    "actualP": "actual P{{position}}"
  },
  "nextSession": {
    "title": "Until the next session"
  },
  "seasonNow": {
    "next": "Next round · {{round}}",
    "until": "Until",
    "ongoing": "The weekend is under way — results soon.",
    "localTime": "Times are in your time zone.",
    "prediction": "Model prediction",
    "details": "Round details",
    "last": "Last round · {{round}}",
    "summary": "Summary",
    "noResults": "No results in the dataset yet.",
    "champion": "Season champion",
    "leaders": "Championship leaders",
    "table": "Table",
    "progress": "Season progress",
    "roundsDone": "Rounds completed:"
  },
  "raceList": {
    "resultsPending": "results pending",
    "winner": "Winner: {{name}}",
    "next": "Next",
    "ongoing": "under way",
    "raceAt": "race {{time}}",
    "none": "No races this season."
  },
  "standingsTable": {
    "final": "Final season standings.",
    "status": "After round <b>{{done}}</b> of {{total}} · <b>{{points}}</b> points still available per driver",
    "champion": "Champion",
    "inContention": "in title contention",
    "fight": "Title fight",
    "fightFinal": "How the title fight unfolded",
    "pos": "Pos.",
    "driver": "Driver",
    "points": "Points",
    "gap": "Gap",
    "wins": "Wins",
    "winsFull": "Wins",
    "podiums": "Podiums",
    "qualiFirst": "Top qualifier",
    "qualiFirstHint": "First place in qualifying",
    "dnfs": "DNFs",
    "form": "Form"
  },
  "teams": {
    "noPoints": "no points",
    "title": "Constructors' championship",
    "wins_one": "{{count}} win",
    "wins_other": "{{count}} wins",
    "podiums_one": "{{count}} podium",
    "podiums_other": "{{count}} podiums"
  },
  "eventCtx": {
    "profile": "Season profile",
    "wasBefore": "was P{{position}} · <b>+{{points}} pts</b> this round",
    "afterFirst": "after the first round",
    "beforeOnly": "Before the round P{{position}}, {{points}} pts",
    "vsTeammate": "Against teammate in the race",
    "quali": "Quali",
    "race": "Race",
    "qualiFaster": "{{value}}% faster in qualifying",
    "qualiSlower": "{{value}}% slower in qualifying",
    "noTeammate": "No teammate data for this round.",
    "history": "Previously at this circuit",
    "firstHere": "The driver's first race at this circuit.",
    "championship": "Championship"
  },
  "rating": {
    "title": "Season rating",
    "notEnough": "Not enough races for a rating (at least 5 needed).",
    "rank": "/ 100 · <b>#{{rank}}</b> of {{of}} drivers this season",
    "lowData": "not enough data",
    "duels": "{{value}}% of duels",
    "gained": "{{value}} pos. per race",
    "spread": "spread ±{{value}} pos.",
    "races": "{{value}}% of races",
    "pointsPerRace": "{{value}} pts per race",
    "explain": "Each component is a percentile among drivers with 5+ races this season (80 = better than 80% of the field); the rating is their average. The dataset does not record who caused an accident.",
    "components": {
      "quali_vs_teammate": {
        "label": "Qualifying vs teammate",
        "hint": "share of duels won"
      },
      "race_vs_teammate": {
        "label": "Race vs teammate",
        "hint": "share of duels won when both finished"
      },
      "positions_gained": {
        "label": "Places gained",
        "hint": "average places gained from start to finish"
      },
      "consistency": {
        "label": "Consistency",
        "hint": "spread of finishing positions (lower is better)"
      },
      "incident_free": {
        "label": "No accidents",
        "hint": "share of races without retiring from an accident or collision (fault not recorded)"
      },
      "results": {
        "label": "Results",
        "hint": "average points per race"
      }
    }
  },
  "vsField": {
    "positions": "Positions by lap",
    "positionsMate": "Positions by lap — with teammate",
    "title": "Versus the field",
    "pace": "Pace (median lap)",
    "rank": "#{{rank}} of {{of}} in the field",
    "vsMedian": "Versus field median",
    "vsWinner": "Versus the winner ({{winner}})",
    "stops": "Pit stops",
    "fieldAvg": "field average {{value}} s",
    "redFlagExcluded_one": "excluding {{count}} under red flag",
    "redFlagExcluded_other": "excluding {{count}} under red flag",
    "explain": "Pace is the median lap excluding pit laps, the first lap and Safety Car laps. Pit stop time is the full pit lane transit."
  },
  "duel": {
    "faster": "{{value}}% faster",
    "slower": "{{value}}% slower",
    "title": "Versus teammate",
    "titleMany": "Versus teammates",
    "vs": "vs",
    "together_one": "{{count}} race together",
    "together_other": "{{count}} races together",
    "quali": "Qualifying",
    "qualiHint": "Who qualified ahead",
    "medianGap": "On median {{gap}} in a shared qualifying segment",
    "race": "Race",
    "raceHint": "Only races where both finished",
    "pointsHint": "Points in races driven together"
  },
  "resultsChart": {
    "pitLane": "pit lane",
    "dnf": "Retired"
  },
  "event": {
    "loadingSessions": "Loading sessions for round {{round}}…",
    "schedule": "Schedule",
    "loading": "Loading round…",
    "resultsPending": "The round has finished but its results are not in the dataset yet — the summary will appear after the data update."
  },
  "driverPage": {
    "loading": "Loading data for {{code}}…",
    "compare": "Compare",
    "updating": "Updating {{session}} data…",
    "position": "Position",
    "classified": "Classified",
    "fastestLap": "Fastest lap of the session",
    "tyreStrategy": "Tyre strategy",
    "degradation": "Tyre degradation",
    "pace": "Lap pace",
    "sectors": "Sector trend",
    "stintSpread": "Pace spread by stint",
    "speedTraps": "Speed traps",
    "allLaps": "All laps"
  },
  "profile": {
    "gp": "Grand Prix",
    "champAfter": "Champ.",
    "champAfterHint": "Championship position after the round",
    "pit": "pit",
    "career": "Career",
    "titles": "Titles",
    "seasons": "Seasons",
    "starts": "Starts",
    "fastestLaps": "Fastest laps",
    "since2004": "data since 2004",
    "debut": "Debut: {{name}} {{year}} · teams: {{teams}}",
    "bestSeason": "best season: {{year}} (P{{position}}, {{points}} pts)",
    "team": "Team",
    "place": "Place",
    "ongoing": "season in progress",
    "loading": "Loading driver profile…",
    "age_one": "{{count}} year old",
    "age_other": "{{count}} years old",
    "inChampionship": "in the {{year}} championship · {{points}} pts",
    "pointsFinishes_one": "points in {{count}} of {{total}} races",
    "pointsFinishes_other": "points in {{count}} of {{total}} races",
    "incidents": "accidents/collisions: {{count}}",
    "none": "none",
    "bestFinish": "Best finish",
    "avgGrid": "Avg. grid",
    "avgFinish": "Avg. finish",
    "finishesOnly": "finishes only",
    "sprintPoints": "Sprint points",
    "byRound": "{{year}} season by round"
  },
  "analysis": {
    "stage": {
      "not_started": "Before qualifying",
      "post_quali": "After qualifying",
      "completed": "Race finished"
    },
    "source": {
      "static_dataset": "dataset",
      "live_fastf1_quali": "live FastF1 data (qualifying)",
      "live_no_quali": "live data, no qualifying"
    },
    "metric": {
      "podium_set": "Top 3 (set)",
      "top5_set": "Top 5 (set)",
      "top10_set": "Top 10 (set)"
    },
    "actual": "Actual",
    "hit": "Prediction matched",
    "generated": "Generated {{date}}",
    "refreshHint": "Rebuild the prediction on the server with the latest data (e.g. after qualifying). May take a few minutes.",
    "refresh": "Refresh prediction",
    "building": "Building the prediction… the first request for this round trains the model, so it may take longer than usual",
    "quality": "Model quality",
    "empty": "No prediction.",
    "importancePosition": "Feature importance — position",
    "importanceDnf": "Feature importance — DNF"
  },
  "sessionPage": {
    "classifiedShort": "Cl.",
    "deltaStart": "Δ grid",
    "laps": "Laps",
    "status": "Status",
    "bestLap": "Best lap",
    "stopNo": "Stop #",
    "duration": "Duration",
    "timeOfDay": "Time of day",
    "weather": "Weather",
    "results": "Results",
    "csvBadge": "CSV — reduced field set",
    "csvSuggest": "This is taking longer than usual — try the fast CSV mode (fewer fields, but instant)?",
    "csvTry": "Try CSV",
    "noResults": "No results.",
    "loadingResults": "Loading {{session}} results…",
    "startFinish": "Grid → Finish",
    "fastestStop": "Fastest: {{code}} {{value}}s",
    "pitTimeline": "Pit stop timeline",
    "loadingLapsLong": "Loading {{session}} laps… for a race or practice this can be hundreds of rows",
    "loadingLaps": "Loading {{session}} laps and drivers…",
    "trackEvolution": "Track evolution",
    "speedTrapRanking": "Speed trap ranking (ST)",
    "bestLaps": "Best laps (from /api/laps — practice results are not very informative)",
    "noLapsYet": "No laps yet.",
    "pickDrivers": "Select drivers (for the pace chart and comparison)",
    "pickTwo": "Select at least 2 drivers",
    "compareSelected": "Compare selected",
    "loadingWeather": "Loading {{session}} weather…"
  },
  "compare": {
    "fastestLap": "Fastest lap — {{code}}",
    "lapTime": "Lap time",
    "sector": "Sector {{n}}",
    "lapNumber": "Lap number",
    "crumb": "Comparison",
    "title": "Driver comparison",
    "removeSlot": "Remove slot {{slot}}",
    "pickDriver": "Select a driver…",
    "pickTwo": "Select at least 2 drivers above to see the comparison.",
    "loading": "Loading comparison of {{drivers}}…",
    "lapTimes": "Lap times",
    "gap": "Gap by lap (cumulative, relative to {{code}})",
    "bestLapDelta": "Best lap difference",
    "fastestLaps": "Fastest laps",
    "strategies": "Tyre strategies"
  }
};

export default en;
