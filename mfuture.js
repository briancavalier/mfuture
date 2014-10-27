exports.create   = create;
exports.never    = never;
exports.of       = of;
exports.delay    = delayed;
exports.map      = map;
exports.join     = join;
exports.flatMap  = flatMap;
exports.get      = get;
exports.earliest = earliest;
exports.catch    = exports.catchError = catchError;
exports.throw    = exports.throwError = throwError;

// --------------------------------------------------------------
// Create

// Create a future by executing a function that will eventually
// provide its value
function create(f) {
	var pending = new Pending();

	try {
		f(set, err);
	} catch(e) {
		err(e);
	}

	function set(x) { become(new Fulfilled(now(), x), pending); }
	function err(x) { become(new Failed(now(), x), pending); }

	return pending;
}

// Create a future with value x
function of(x) {
	return new Fulfilled(minTime(), x);
}

// --------------------------------------------------------------
// Transform

// Return a new future whose value has been transformed by f
function map(f, future) {
	return future.when(f, rethrow);
}

// Turn a future future value into a future value
function join(future) {
	return future.join();
}

// Transform future's value into a new future
function flatMap(f, future) {
	return future.flatMap(f);
}

// Apply a future function to a future x to get a future y
function ap(ff, fx) {
	return ff.flatMap(function(f) {
		return fx.map(f);
	});
}

// Execute f with the value of a future when it becomes available
// If future fails, get will throw an uncatchable error
// Does not return a new future.
function get(f, future) {
	future.when(f, fail);
}

// Create a future that reveals its value x only after a delay
function delayed(dt, x) {
	return create(function (set) {
		timer(set, dt, x);
	});
}

// --------------------------------------------------------------
// Time

// Delay a future
function delay(dt, future) {
	return flatMap(function(x) {
		return delayed(dt, x);
	}, future);
}

// Choose the earliest of two futures, based on their time
function earliest(a, b) {
	var at = a.time();
	var bt = b.time();

	return at < bt ? a
	     : bt < at ? b
	     : awaitEarliest(a, b);
}

function awaitEarliest(a, b) {
	var p = new Pending();

	a.when(becomea, becomea);
	b.when(becomeb, becomeb);

	return p;

	function becomea() { become(a, p); }
	function becomeb() { become(b, p); }
}

// --------------------------------------------------------------
// Errors

// Recover from a failed future
function catchError(f, future) {
	return future.when(identity, f);
}

// Create a failed future
function throwError(e) {
	return new Failed(minTime(), e);
}

// Throw an uncatchable error
function fail(e) {
	timer(rethrow, 0, e);
}

function rethrow(e) {
	throw e;
}

// --------------------------------------------------------------
// Time

// Use a counter rather than wall-clock time, since all
// we really need is *ordering*, not actual *time*
var currentTime = 0;
function now() {
	return currentTime++;
}

function maxTime() {
	return Infinity;
}

function minTime() {
	return -Infinity;
}

function timer(f, t, x) {
	return setTimeout(f, t, x);
}

// --------------------------------------------------------------
// Future prototype

function Future() {}

// Default implementations, subtypes override where necessary
Future.prototype.map     = function(f)  { return map(f, this); };
Future.prototype.flatMap = function(f)  { return map(f, this).join(); };
Future.prototype.catch   = function(f)  { return catchError(f, this); };
Future.prototype.get     = function(f)  { return get(f, this); };
Future.prototype.join    = function()   { return this.value; };
Future.prototype.time    = function()   { return this.at; };
Future.prototype.delay   = function(dt) { return delay(dt, this); };

// --------------------------------------------------------------
// Never

// Future that will never acquire a value
function Never() {}

Never.prototype = Object.create(Future.prototype);
Never.prototype.when = Never.prototype.join = Never.prototype.flatMap = never;
Never.prototype.time = maxTime;

// Never singleton
var _never = new Never();
function never() {
	return _never;
}

// --------------------------------------------------------------
// Fulfilled

// Future whose value is available immediately
function Fulfilled(t, x) {
	this.at = t;
	this.value = x;
}

Fulfilled.prototype = Object.create(Future.prototype);

Fulfilled.prototype.when = function(f) {
	return mapFuture(f, this.at, this.value);
};

Fulfilled.prototype.flatMap = function(f) {
	return f(this.value);
};

// --------------------------------------------------------------
// Failed

// Future that has failed to produce a value
function Failed(t, e) {
	this.at = t;
	this.value = e;
}

Failed.prototype = Object.create(Future.prototype);

Failed.prototype.when = function(f, r) {
	return mapFuture(r, this.at, this.value);
};

Failed.prototype.flatMap = function() {
	return new Failed(this.at, this.value);
};

// --------------------------------------------------------------
// Pending

// Future whose fate is not yet revealed
function Pending() {
	this.value = never();
	this.resolved = false;
	this.queue = [];
}

Pending.prototype = Object.create(Future.prototype);

Pending.prototype.when = function(f, r) {
	if (this.resolved) {
		return this.value.when(f, r);
	}

	var p = new Pending();
	this.queue.push(new Map(f, r, p));
	return p;
};

Pending.prototype.join = function() {
	if (this.resolved) {
		return this.value.join();
	}

	var p = new Pending();
	this.queue.push(new Join(p));
	return p;
};

Pending.prototype.time = function() {
	return this.value.time();
};

// Assign the state of future to pending. Throws if pending
// already has a value.
// pending must be a Pending, future can be any future
function become(future, pending) {
	if(pending.resolved) {
		throw new Error('Future value already set');
	}

	pending.resolved = true;
	pending.value = future;
	pending.queue = resolve(pending.queue, future);
}

// --------------------------------------------------------------
// Helpers

// Try to map a value to a future
function mapFuture(f, t, x) {
	try {
		return new Fulfilled(t, f(x));
	} catch(e) {
		return new Failed(t, e);
	}
}

function resolve(q, x) {
	for(var i=0; i<q.length; ++i) {
		q[i].resolve(x);
	}
}

function Map(f, r, p) {
	this.f = f; this.r = r; this.p = p;
}

Map.prototype.resolve = function(x) {
	become(x.when(this.f, this.r), this.p);
};

function Join(p) {
	this.p = p;
}

Join.prototype.resolve = function(x) {
	var xj = x.join();
	var value = xj.flatMap(function(xv) {
		return new Fulfilled(Math.max(x.time(), xj.time()), xv);
	});

	become(value, this.p);
};

function identity(x) { return x; }