"use strict";

var APP_NAME = "IoT Basics - TechNight";
var Cfg = require("./utl/cfg-app-platform.js");    // get Cfg() constructor
var cfg = new Cfg();                               // init and config I/O resources

var mqtt = require('mqtt');
var mraa = require('mraa');
var groveSensor = require('jsupm_grove');
var upmBuzzer = require("jsupm_buzzer");

console.log("\n\n\n\n\n\n");                       // poor man's clear console
console.log("Initializing " + APP_NAME);

process.on("exit", function(code) {                 // define up front, due to no "hoisting"
    clearInterval(intervalID);
    console.log(" ");
    console.log("Exiting " + APP_NAME + ", with code:", code);
    console.log(" ");
}) ;


// confirm that we have a version of libmraa and Node.js that works
// exit this app if we do not

cfg.identify() ;                // prints some interesting platform details to console

if( !cfg.test() ) {
    process.exit(1);
}

if( !cfg.init() ) {
    process.exit(2);
}



// configure (initialize) our I/O pins for usage (gives us an I/O object)
// configuration is based on parameters provided by the call to cfg.init()

//led
cfg.io = new cfg.mraa.Gpio(cfg.ioPin, cfg.ioOwner, cfg.ioRaw);
cfg.io.dir(cfg.mraa.DIR_OUT);
var ledState;

//buzzer
var buzzer = new upmBuzzer.Buzzer(3);
buzzer.stopSound();

//light sensor
var light = new groveSensor.GroveLight(0);

//temp sensor
var temp = new mraa.Aio(1);

//rotary
var rotary = new groveSensor.GroveRotary(2);

//touch
var touchPin = new mraa.Gpio(2);
touchPin.dir(mraa.DIR_IN);

//connect to mqtt server
var client = mqtt.connect('mqtt://52.173.72.219/mqtt');

//subscribe to topics
client.on('connect', function(){
    console.log('Connected to mqtt server 52.173.72.219');
    client.subscribe('IoT/led/device');
    client.subscribe('IoT/alarm/device');
});

//act on incoming messages from subscribed topics
client.on('message', function(topic, message){
    console.log('Received message', topic, message.toString());
    
    //led flash
    if(topic == 'IoT/led/device'){
        var count = 0;
        function stopFlash(){
            if(count >= 20){
                clearInterval(flashInterval);
                client.publish('IoT/led/web',JSON.stringify({'client': 'intel edison 1', 'timestamp': new Date(), 'message': 'LED flashed'}));
            }
        }
        var flashLed = function(){
            ledState = cfg.io.read(); 
            cfg.io.write(ledState?0:1);
            stopFlash();
            count++;
        }
        var flashInterval = setInterval(flashLed, 100);
    }
    //alarm
    else if(topic == 'IoT/alarm/device'){
        buzzer.setVolume(0.25);
        //notes
        var n ={
            C0:     2109.89,
            Cs0:    1991.47,
            D0:     1879.69,
            E0:     1674.62,
            F0:     1580.63,
            Fs0:    1491.91,
            G0:     1408.18,
            Gs0:    1329.14,
            A0:	    1254.55,
            As0:    1184.13,
            B0:	    1117.67,
            C1:     1054.94,
            Cs1:    995.73,
            D1:	    939.85,
            Ds1:    887.10,
            E1:     837.31,
            F1:     790.31,
            Fs1:    745.96,
            G1:     704.09,
            Gs1:    664.57,
            A1:     627.27,
            As1:    592.07,
            B1:     558.84,
            C2:     527.47,
            Cs2:    497.87,
            D2:	    469.92,
            r:      0
        }
        //var chart = [ [n.B0, 1/2], [n.D1, 1/4], [n.A0, 1/2], [n.G0, 1/8], [n.A0, 1/8], [n.B0, 1/2], [n.D1, 1/4], [n.A0, 3/4] ];
        var chart = [[n.D1,1/16], [n.r,1/16], [n.D1,1/16], [n.r,1/4], [n.D1,1/16], [n.r,1/16], [n.D1,1/16]]
        var beat = 0;
        function song(){

            if(beat < chart.length){
                if(chart[beat][0] != 0)
                    buzzer.playSound(chart[beat][0],2 * 1000000 * chart[beat][1]);
                else
                    buzzer.playSound(1,2 * 1000000 * chart[beat][1]);
                
                beat++;
                song();
            }
            buzzer.stopSound();
            
        }
        song();
        client.publish('IoT/alarm/web',JSON.stringify({'client': 'intel edison 1', 'timestamp': new Date(), 'message': 'Alarm played'}));
    }
    
});

//publish to topics
//send temp
setInterval(function () {
    var a = temp.read();
    var resistance = (1023 - a) * 10000 / a; //get the resistance of the sensor;
    var celsius_temperature = 1 / (Math.log(resistance / 10000) / 3975 + 1 / 298.15) - 273.15;//convert to temperature via datasheet ;
    var fahrenheit_temperature = (celsius_temperature * (9 / 5)) + 32;
    console.log("Fahrenheit Temperature: " + fahrenheit_temperature);
    client.publish('IoT/temp/web',JSON.stringify({'client': 'intel edison 1', 'timestamp': new Date(), 'message': fahrenheit_temperature}));
}, 1000);

//send light level
function readLightSensorValue() {
    console.log(light.name() + " raw value is " + light.raw_value() + ", which is roughly " + light.value() + " lux");
    client.publish('IoT/light/web',JSON.stringify({'client': 'intel edison 1', 'timestamp': new Date(), 'message': light.value()}));
}
setInterval(readLightSensorValue, 1000);

//rotary angle
function rotaryAngle()
{
    var reldeg = rotary.rel_deg();

    console.log("Rotary: " + Math.round(parseInt(reldeg)));
    client.publish('IoT/rotary/web',JSON.stringify({'client': 'intel edison 1', 'timestamp': new Date(), 'message': Math.round(parseInt(reldeg))}));

    setTimeout(rotaryAngle, 1000);
}
rotaryAngle();

//touch
var touchValue = 0;
var lastTouchValue = 0;
function touchPoll(){
    touchValue = touchPin.read()
    if(touchValue === 1 && lastTouchValue === 0){
        console.log("Touch: " + touchValue);
        client.publish('IoT/touch/web',JSON.stringify({'client': 'intel edison 1', 'timestamp': new Date(), 'message': touchValue}));
    }
    else if(touchValue === 0 && lastTouchValue === 1){
        console.log("Touch: " + touchValue);
        client.publish('IoT/touch/web',JSON.stringify({'client': 'intel edison 1', 'timestamp': new Date(), 'message': touchValue}));
    }
    lastTouchValue = touchValue;
}
setInterval(touchPoll, 100);