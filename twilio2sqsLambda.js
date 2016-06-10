// Lambda function for receiving messages from Twilio and placing them to SQS
var aws = require('aws-sdk');

const QUEUE_URL = '[specify SQS URL here]';
const sqs = new aws.SQS({ apiVersion: '2016-06-10' });

// main handler
exports.handler = function(event, context) {
    console.info('handler: Received event:',JSON.stringify(event,null,2));
    console.info('handler: Context:',JSON.stringify(context,null,2));
    
    const output = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
    var params = {
        MessageBody: JSON.stringify(event),
        QueueUrl: QUEUE_URL
    };
    try {
        sqs.sendMessage(params, function(err,data){
            if(err) {
                console.error('handler: FAILED! Cannot send the message, err = ' + err);
                context.fail(err);
            } else {
                console.info('handler: SUCCESS! MessageId = ' + data.MessageId);
                context.succeed(output);
            }
        });
    } catch (ex) {
        console.error('handler: EXCEPTION! ex = ' + ex);
        context.fail(ex);
    }
};

// Twilio sends requests with content type application/x-www-form-urlencoded
// To enable API gateway to parse them you need to go to Integration Request
// Under Integration Request go to Mapping Templates and set content type to
// application/x-www-form-urlencoded and select Mapping Template of type Empty
// Save your mapping template
// Screenshot of complete config: http://cl.ly/image/450F321o1X2O

// By default lambda will try to render the response as JSON which will break TwiML
// To override you need to go to Integration Response then Mapping Templates
// Create a new Mapping Template with the following code
// #set($inputRoot = $input.path('$'))
// $inputRoot
// Save this new mapping
// Screenshot of complete config: http://cl.ly/image/363O3p1V2s3t

// Lastly you need to make sure the respnse is returned in XML instead of JSON
// To configure this go to Method Response, expand the 200 tab and add a new
// Response Models for 200 entry. Set content type to application/xml and save
// Screenshot of complete config: http://cl.ly/image/1v1E3u2d3i1m