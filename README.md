# Algebraic future values

This is an simple implementation of algebraic future values: values that are revealed at a particular time, possibly in the future.

These are not [Promises](http://promisesaplus.com).  Future values are much simpler, and have an explicit notion of time.  They don't cover the same use cases as Promises.

## Algebraic

Futures are algebraic: functor is `map`, applicative is `ap`, and monad is `flatMap` (bind), and `of` (return).

```js
// in 1 second, reveal this future's value as 123
var future = mfuture.delay(1000, 123);

var future2 = future.flatMap(function(x) {
	return mfuture.delay(5000, x+1);
});

// In 6 seconds, log 124
future2.get(console.log.bind(console));
```

## Time

Future values have an explicit time at which their value is revealed.  Before that, neither the time nor the value can be known.

Note that the time is a simple monotonic integer and *is not* wall-clock time.

```js
var future = mfuture.delay(1000, 123);

console.log(future.time()); // Infinity

setTimeout(function() {
	console.log(future.time()); // integer
}, 1001);
```

The time allows futures to have causal ordering.  Given 2 futures, it's possible to unambiguously determine which is/was the earlier of the two, even if both have already been revealed.

```js
var f1 = mfuture.delay(1000, 'late');
var f2 = mfuture.of('early');

// Logs 'early' immediately
mfuture.earliest(f1, f2).get(console.log.bind(console));

// Logs 'early' after 2 seconds
setTimeout(function() {
	mfuture.earliest(f1, f2).get(console.log.bind(console));
}, 2000);
```

Note the Promises do not support this, since they don't keep track of any notion of the time at which they settled.

At first glance, `Promise.race` seems to work this way, but it doesn't.  Take the following example:

```js
var p1 = delayedPromise(1000, 'late');
var p2 = Promise.resolve('early');

// The result of Promise.race depends on *when* it is called

// Logs 'early' immediately
Promise.race([p1, p2]).then(console.log.bind(console));

// Logs 'late' (!!) after 2 seconds
setTimeout(function() {
	Promise.race([p1, p2]).then(console.log.bind(console));
}, 2000);
```