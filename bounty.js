require('dotenv').config();
var ComfyJS = require("comfy.js");

async function createRevarte(){
    
    let customReward = await ComfyJS.CreateChannelReward(process.env.CLIEN, {
    title: "Test Reward",
    prompt: "Test Description",
    cost: 100,
    is_enabled: true,
    background_color: "#00E5CB",
    is_user_input_required: false,
    is_max_per_stream_enabled: false,
    max_per_stream: 0,
    is_max_per_user_per_stream_enabled: false,
    max_per_user_per_stream: 0,
    is_global_cooldown_enabled: false,
    global_cooldown_seconds: 0,
    should_redemptions_skip_request_queue: true
} );}

async function dellRevarte(){
    await ComfyJS.DeleteChannelReward( clientId, customReward.id );
}


module.exports = { createRevarte, dellRevarte }