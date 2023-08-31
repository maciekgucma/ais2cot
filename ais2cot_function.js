/*
This function works with AIS parser NODE-RED https://github.com/chrisadie/node-red-contrib-ais-decoder
Node of AIS parser is Yellow one on paleete:)
TODO:
check number 5 msg for NAME of vessel else use MMSI [done]
mySQL linkage

2 outputs: one with CoT and one with full msg object from AIS for Dbase

*/
// Initialize the name of vessel stored in the context
context.name = context.name || {};

// Ensure xmlbuilder is available if not check settings.js !!! XMLBUILDER is a node.js not N-red
var xmlbuilder = global.get('xmlbuilder');
if (!xmlbuilder) {
    node.error("xmlbuilder module not found in the context");
    return;
}

// Check if the incoming AIS message is valid
function isValidAIS(aivdm) {
    
    return aivdm &&
        aivdm.senderMmsi &&
        aivdm.latitude !== null &&
        aivdm.longitude !== null;
}
//function trnslating the AIS object to CoT
function ais2cot(aivdm) {
    let vesselName = context.name[aivdm.senderMmsi] || aivdm.senderMmsi; //if yes then NAME if not then MMS
    let timestamp = new Date().toISOString();
    
    var cotMessage = xmlbuilder.create({
        event: {
            '@version': '2.0',
            '@uid': aivdm.senderMmsi,
            '@type': 'a-f-S-X-M-C',  //this is merchant vessel - change accordingly 
            '@time': timestamp,
            '@start': timestamp,
            '@stale': new Date(Date.now() + 360000).toISOString(), //stale 6 mins
            '@how': 'm-g',
            '@access': 'undefined',
            point: {
                '@lat': aivdm.latitude,
                '@lon': aivdm.longitude,
                '@hae': '7.10000000',
                '@ce': '9999999',
                '@le': '9999999'
            },
            detail: {
                takv: {
                    '@os': '33',
                    '@device': aivdm.messageType_text,
                    '@platform': aivdm.talkerId_text,
                    '@version': '2.0'
                },
                uid: {
                    '@Droid': aivdm.senderMmsi
                },
                precisionlocation: {
                    '@altsrc': 'gnss'
                },
                contact: {
                    '@endpoint': '*:-1:stcp',
                    '@callsign': vesselName  //NAME takien fromm no5 msg
                },
                __group: {
                    '@name': 'Cyan',
                    '@role': 'Team Member'
                },
                track: {
                    '@speed': aivdm.speedOverGround,
                    '@course': aivdm.courseOverGround
                }
            }
        }
    }).end({ pretty: true });
    return cotMessage;
}

// Checking the validity of the AIS message
if (isValidAIS(msg.payload)) {
    // If the AIS message is of type 5, store the vessel name!!! in context
    if (msg.payload.messageType === 5 && msg.payload.name) {
        context.name[msg.payload.senderMmsi] = msg.payload.name;  // its the proper name outputed from no 5 msg
    }
    const originalWithVesselName = Object.assign({}, msg.payload);
    if (context.name[msg.payload.senderMmsi]) {
        originalWithVesselName.vesselName = context.name[msg.payload.senderMmsi];
    }

    // Create the CoT message
    const cotMessage = ais2cot(msg.payload);

    // outputs
    return [
        {payload: cotMessage },
        {payload: originalWithVesselName }
    ];

} else {
    //node.warn("Invalid AIS message received. Skipping.");  //if uncomented will generate when error
    return null;  // Skip the message - no payload
}

