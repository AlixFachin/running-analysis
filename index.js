
function getXMLParser() {
    let parseXml;

    if (typeof window.DOMParser != "undefined") {
        parseXml = function(xmlStr) {
            return ( new window.DOMParser() ).parseFromString(xmlStr, "text/xml");
        };
    } else if (typeof window.ActiveXObject != "undefined" &&
           new window.ActiveXObject("Microsoft.XMLDOM")) {
        parseXml = function(xmlStr) {
            var xmlDoc = new window.ActiveXObject("Microsoft.XMLDOM");
            xmlDoc.async = "false";
            xmlDoc.loadXML(xmlStr);
            return xmlDoc;
        };
    } else {
        throw new Error("No XML parser found");
    }

    return parseXml;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

class Trackpoint {
    
    static keyProperties = {
        'ns3:Speed' : 'speed',
        'LatitudeDegrees' : 'lat',
        'LongitudeDegrees' : 'long',
        'Time' : 'timestamp',
        'AltitudeMeters' : 'altitude',
        'DistanceMeters' : 'distance',
        'HeartRateBpm' : 'hr',
    }

    constructor(xml) {
        if (xml.nodeType !== 1 || xml.nodeName !== 'Trackpoint' ) {
            // Should maybe raise an error there
            console.error('Wrong XML node passed to Trackpoint conversion!')
            return;
        }

        this.setProperties(xml);

     }


    setProperties(xml) {
        if (xml.nodeType === 1 && Trackpoint.keyProperties[xml.nodeName]) {
            const propertyName = Trackpoint.keyProperties[xml.nodeName];
            this[propertyName] = xml.textContent.trim();
        }
        for (let i=0; i< xml.childElementCount; i++) {
            this.setProperties(xml.children[i]);
        }
    }

}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function findDataInXML(xml, dataArray=[]) {
    
    if (xml.nodeType === 1 && xml.nodeName === 'Trackpoint') {
        const tp = new Trackpoint(xml);
        dataArray.push(tp);
    } else {
        for (let i=0; i < xml.childElementCount; i++) {
            findDataInXML(xml.children[i], dataArray);
        }
    }
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// CHART-RELATED ROUTINES

function getChart(context) {
    
    for (let chartId in Chart.instances) {
        let currentChart = Chart.instances[chartId];
        if (currentChart.ctx === context) {
            return currentChart;
        }
    }
    return undefined;

}

function gradientColor(context) {
    
    
    var index = context.dataIndex;
    var totalNumber = context.dataset.data.length;
    return `hsl(30,${Math.trunc(index/totalNumber*100)}%,50%)`
    
}

function addTimeSeriesGraph(context, dataTable, yAxis='speed') {

    const chartData = getTimeSeries(dataTable, yAxis);
    var timeSeriesChart = new Chart(context,
        { type: 'line', 
        data: {
            datasets: [{
                label: yAxis,
                data: chartData,
                borderColor: gradientColor,
                //backgroundColor: 'red',
           }],
        },
        options: {
            responsive:false,
            maintainAspectRatio:true,
            legend:false,
            scales: {
                xAxes: [{
                    type:'time',
                    time: {
                        //2021-03-15T01:42:26.000Z
                        parser: "YYYY-MM-DDTHH:MM:SS",
                    }
                }]
            }
        }
       } );
    return timeSeriesChart;

}

function updateTimeSeriesGraph(context, dataTable, yAxis = 'speed') {
    const currentChart = getChart(context);
    if (currentChart) {currentChart.destroy();}
    // Exit case if the graph doesn't exist, we are going to create it
    return addTimeSeriesGraph(context,dataTable, yAxis);

    // const newData = getTimeSeries(dataTable, yAxis);
    // currentChart.data.labels.push(yAxis);
    // currentChart.data.datasets.forEach( dataset => dataset.data.push(newData) );
    // currentChart.data.labels.shift();
    // currentChart.data.datasets.forEach( dataset=> dataset.data.shift() );
    // // currentChart.update(0);
    // currentChart.update();

}

function updateScatterGraph(context, dataTable, xAxis, yAxis) {
    const currentChart = getChart(context);
    if (currentChart) { currentChart.destroy();}
    return addXYScatterGraph(context, dataTable, xAxis, yAxis);
}

function addXYScatterGraph(context, dataTable, xAxis, yAxis) {
    const chartData = getXYSeries(dataTable, xAxis, yAxis);

    var timeSeriesChart = new Chart(context,
        { type: 'scatter', 
        data: {
            datasets: [{
                label: yAxis,
                data: chartData,
                borderColor: gradientColor,  
           }],
        },
        options: {
            responsive:false,
            maintainAspectRatio:true,
            legend:false,
            scales: {
                xAxes: [{
                    type:'linear',
                    position: 'bottom',
                }]
            }
        }
       } );
    return timeSeriesChart;

}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// DATA MANIPULATION ROUTINES

function getTimeSeries(dataArray, yAxis) {
    const selector = {
        'speed': (tp => tp.speed*3.6),
        'altitude' : (tp => tp.altitude*1),
        'hr' : (tp => tp.hr*1),
    }
    
    const getYData = selector[yAxis] || (tp => tp.speed*3.6);

    return dataArray.map( tp => ({ t: new Date(tp.timestamp), y: getYData(tp) }));

}

function getXYSeries(dataArray, xAxis, yAxis) {
    const selector = {
        'speed': (tp => tp.speed*3.6),
        'altitude' : (tp => tp.altitude*1),
        'hr' : (tp => tp.hr*1),
    }
    console.log(`Getting XY series for ${xAxis} and ${yAxis}`);
    const getXData = selector[xAxis] || ( tp => tp.distance*1);
    const getYData = selector[yAxis] || ( tp => tp.speed*3.6);

    return dataArray.map(tp => ({ x: getXData(tp), y: getYData(tp) }));

}