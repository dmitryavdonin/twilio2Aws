// Lambda function for transfeting messages from SQS to DynamicDB
'use strict';

var aws = require('aws-sdk');

const sqs = new aws.SQS({ apiVersion: '2016-06-10' });
const lambda = new aws.Lambda({ apiVersion: '2016-06-10' });
const QUEUE_URL = '[specify SQS URL here]';
const PROCESS_MESSAGE = 'process-message';

var db = new aws.DynamoDB();

// processign of messages retrieved from SQS
function processMessage(message, callback) {
    console.info('processMessage: Start processing of a message = ' + message);
    try
    {
        var body = JSON.parse(message.Body);
        if(body){
            var item = {
                'Date': { 'S': new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '') },
                'MessageId': { 'S': message.MessageId },
                'To': { 'S': (body.to) ? body.to : '' },
                'From': { 'S': (body.from) ? body.from : '' },
                'Body': { 'S': (body.body) ? body.body : '' }
            };
              
            var response = db.putItem({
                'TableName': 'Messages',
                'Item': item
            }, function(err, data) {
                if (err) {
                    console.error('processMessage: FAILED! Cannot put the message to DB, MessageId = ' + message.MessageId + '; err = ' + err);
                    callback(err);
                } else {
                    // delete message
                    console.info('processMessage: SUCCESS! Message inserted to DB, MessageId = ' + message.MessageId);
                    const params = {
                        QueueUrl: QUEUE_URL,
                        ReceiptHandle: message.ReceiptHandle
                    };
                    
                    sqs.deleteMessage(params, (err, data) => {
                        if (err) {
                            console.error('processMessage: FAILED! Cannot delete the message from SQS, MessageId = ' + message.MessageId);
                            callback(err, err.stack);
                        } else {
                            console.info('processMessage: SUCCESS! Message was deleted from SQS, MessageId = ' + message.MessageId);
                            callback(null, data);
                        }
                    });
                  }
              });
        } else {
            console.error('processMessage: FAILED! Cannot parse message Body, MessageId = ' + message.MessageId);
            callback('Cannot parse message Body');
        }
    } catch(ex) {
        callback(ex);
    }
}
// polling messages form SQS
function pollingSQS(functionName, callback) {
    console.info('pollingSQS: start polling SQS, functionName = ' + functionName);
    const params = {
        QueueUrl: QUEUE_URL,
        MaxNumberOfMessages: 10,
        VisibilityTimeout: 10
    };
    
    // batch request messages
    sqs.receiveMessage(params, (err, data) => {
        if (err) {
            return callback(err);
        }
        // for each message, reinvoke the function
        if(data.Messages) {
            const promises = data.Messages.map((message) => {
                console.info('pollingSQS: message = ', message);
                const payload = {
                    operation: PROCESS_MESSAGE,
                    message: message
                };
                const params = {
                    FunctionName: functionName,
                    InvocationType: 'Event',
                    Payload: new Buffer(JSON.stringify(payload))
                };

                return new Promise((resolve, reject) => {
                    lambda.invoke(params, (err) => err ? reject(err) : resolve());
                });
            });
            // complete when all invocations have been made
            Promise.all(promises).then(() => {
                console.info('pollingSQS: SUCCESS! Mesagess received: ' + data.Messages.length);
                callback(null, 'Messages received: ' + data.Messages.length);
            });
        } else {
            console.warn('pollingSQS: No messages received');
            callback('No messages received');
        }
    });
}
// the main handler of lambda
exports.handler = (event, context, callback) => {
    console.info('handler: Received event:',JSON.stringify(event,null,2));
    console.info('handler: Context:',JSON.stringify(context,null,2));
    
    try {
        if (event.operation === PROCESS_MESSAGE) {
            // invoked by poller
            processMessage(event.message, callback);
        } else {
            // invoked by schedule
            pollingSQS(context.functionName, callback);
        }
    } catch (err) {
        callback(err);
    }
};