require('dotenv').config()
const { Paddle, Environment } = require('@paddle/paddle-node-sdk')

async function testPaddle() {
  const paddle = new Paddle(process.env.PADDLE_API_KEY, {
    environment: Environment.Sandbox
  })

  console.log('Using Key:', process.env.PADDLE_API_KEY ? process.env.PADDLE_API_KEY.slice(0, 15) + '...' : 'NONE')
  console.log('Using Price:', process.env.PADDLE_PRODUCT_ID)

  try {
    const prices = paddle.prices.list()
    const firstPage = await prices.next()
    console.log('✅ Success! Found prices:', firstPage.map(p => p.id))
  } catch (err) {
    console.error('❌ PADDLE ERROR DETAILS:')
    console.dir(err, { depth: null })
  }
}

testPaddle()
