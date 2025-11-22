const amqplib=require('amqplib');
const logger=require('../utils/logger');


let connection=null;
let channel=null;

const connectToRabbitMQ=async()=>{
    if(channel!==null) return channel;
    try{
        const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
        const queueName = process.env.QUEUE_NAME || 'instagram_events';
        
        connection=await amqplib.connect(rabbitmqUrl);
        channel=await connection.createChannel();
        await channel.assertQueue(queueName,{durable:true});
        
        logger.info(`Connected to RabbitMQ at ${rabbitmqUrl}`);
        return channel;
    }catch(err){
        logger.error(`Error connecting to RabbitMQ: ${err.message}`);
        throw err;
    }
}

const publishEvent=async(routingKey,message)=>{
    try{
        const channel=await connectToRabbitMQ();
        const exchangeName=process.env.EXCHANGE_NAME || 'instagram_events_exchange';
        await channel.assertExchange(exchangeName, 'direct', {durable:true});
        await channel.publish(exchangeName, routingKey, Buffer.from(JSON.stringify(message)), {persistent:true});
        logger.info(`Published event to RabbitMQ: ${routingKey}`);
    }catch(err){
        logger.error(`Error publishing event to RabbitMQ: ${err.message}`);
        throw err;
    }
}

const consumeEvent=async(queueName, callback)=>{
    try{
        const channel=await connectToRabbitMQ();
        await channel.assertQueue(queueName, {durable:true});
        await channel.consume(queueName, (msg)=>{
            if(msg){
                const message=msg.content.toString();
                callback(message);
                channel.ack(msg);
            }
        });
        logger.info(`Consuming events from RabbitMQ: ${queueName}`);
    }catch(err){
        logger.error(`Error consuming events from RabbitMQ: ${err.message}`);
        throw err;
    }
}   



module.exports={connectToRabbitMQ,publishEvent,consumeEvent};