import Faye from 'react-native-halley'
const noop = () => {}
import {NetInfo} from 'react-native'

class ClientAuthExt {
  constructor(token) {
    this._token = token
  }

  outgoing(message, cb) {
    if (message.channel === '/meta/handshake') {
      if (!message.ext) { message.ext = {}; }
      message.ext.token = this._token
      message.ext.realtimeLibrary = 'halley'
    }

    cb(message);
  }

  incoming(message, cb) {
    if (message.channel === '/meta/handshake') {
      if (message.successful) {
        console.log('Successfuly subscribed: ', message);
      } else {
        console.log('Something went wrong: ', message.error);
      }
    }

    cb(message)
  }
}

class LogExt {
  outgoing(message, cb) {
    console.log('Log outgoing message: ', message)
    cb(message)
  }

  incoming(message, cb) {
    console.log('Log incoming message: ', message)
    cb(message)
  }
}

class SnapshotExt {
  constructor(fn) {
    this._handler = fn
  }
  incoming(message, cb) {
    if (message.channel === '/meta/subscribe' && message.ext && message.ext.snapshot) {
      this._handler(message)
    }

    cb(message)
  }
}


export default class HalleyClient {
  constructor({token, snapshotHandler}) {
    this._client = new Faye.Client('https://ws.gitter.im/bayeux', {
      timeout: 3000,
      retry: 3000,
      interval: 0,
      maxNetworkDelay: 3000,
      connectTimeout: 3000,
      disconnectTimeout: 1000
    })
    this._token = token
    this._snapshotHandler = snapshotHandler
    this._subsciptions = []
    this._isConnectedToNetwork = true
    this._transport = true

    this.setupNetworkListeners()
    this.setupInternetListener()
  }

  setToken(token) {
    this._token = token
  }

  setSnapshotHandler(fn) {
    this._snapshotHandler = fn
  }

  setup() {
    if (!this._token) {
      throw new Error('You need to add token')
    }

    this._snapshotExt = new SnapshotExt(this._snapshotHandler || noop)
    this._authExt = new ClientAuthExt(this._token)
  }

  create() {
    if (!this._token) {
      throw new Error('You need to add token')
    }
    this._client.addExtension(this._authExt)
    this._client.addExtension(this._snapshotExt)
    this._client.addExtension(new LogExt())
  }

  subscribe({type, url, handler}) {
    return new Promise((res, rej) => {
      if (this._checkSubscriptionAlreadyExist({type, url})) {
        rej(`Subscription with type ${type} and url ${url} already exist.`)
      }

      const subscriptionObject = this._client.subscribe(url, handler)

      subscriptionObject
        .then(() => {
          this._subsciptions.push({
            type,
            url,
            handler,
            subscriptionObject
          })
          res(true)
        })
        // .catch(err => {
        //   rej(err)
        // })
    })
  }

  unsubscribe({type, url}) {
    return new Promise((res, rej) => {
      const subscription = this._findSubscription({type, url})
      if (!subscription) {
        rej(`There is no subscription with type ${type} and url ${url}`)
      } else {
        subscription.subscriptionObject.unsubscribe()
          .then(() => {
            this._removeSubscription(subscription)
            res(true)
          })
          // .catch(err => rej(err))
      }
    })
  }

  setupNetworkListeners() {
    // this._client.on('transport:down', () => {
    //   this._transport = false
    // })
    //
    // this._client.on('transport:up', () => {
    //   this._transport = true
    // })
  }

  setupInternetListener() {
    // NetInfo.isConnected.addEventListener(
    //   'change',
    //   () => {
    //     debugger
    //     NetInfo.isConnected.fetch()
    //       .then(isConnected => {
    //         if (isConnected) {
    //           this._client.connect()
    //           // this._isConnectedToNetwork = true
    //         } else {
    //           // this._isConnectedToNetwork = false
    //         }
    //       })
    //   }
    // )
  }

  _checkSubscriptionAlreadyExist(subscriptionOptions) {
    const subscription = this._findSubscription(subscriptionOptions)
    return !!subscription
  }

  _findSubscription({type, url}) {
    return this._subsciptions.find(
      item => item.type === type && item.url === url
    )
  }

  _removeSubscription({type, url}) {
    const index = this._subsciptions.indexOf(
      item => item.type === type && item.url === url
    )

    if (index !== -1) {
      this._subsciptions.splice(index, 1)
    }
  }
}
