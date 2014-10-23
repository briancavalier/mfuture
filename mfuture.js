exports.create = create;
exports.never = never;
exports.of = of;
exports.map = map;
exports.flatMap = flatMap;
exports.catch = exports.catchError = catchError;
exports.get = get;

function create(f) {
	var fv = new FutureValue();

	try {
		f(fv);
	} catch(e) {
		fv.error(e);
	}

	return fv.future;
}

var _never = new Never();
function never() {
	return _never;
}

function of(x) {
	return new Fulfilled(x);
}

function map(f, future) {
	return future.when(f);
}

function flatMap(f, future) {
	return map(f, future).join();
}

function catchError(f, future) {
	return future.when(null, f);
}

function get(f, future) {
	future.when(f, fail);
}

function fail(e) {
	setTimeout(function() { throw e; }, 0);
}

function FutureValue() {
	this.future = new Pending();
}

FutureValue.prototype.set = function(x) {
	become(new Fulfilled(x), this.future);
};

FutureValue.prototype.error = function(e) {
	become(new Failed(e), this.future);
};

// Future prototype
var future = {
	map:     function(f) { return map(f, this); },
	flatMap: function(f) { return flatMap(f, this); },
	catch:   function(f) { return catchError(f, this); },
	get:     function(f) { return get(f, this); }
};

// Future that will never acquire a value
function Never() {}

Never.prototype = Object.create(future);
Never.prototype.when = Never.prototype.join = never;

// Future whose value is available immediately
function Fulfilled(x) {
	this.value = x;
}

Fulfilled.prototype = Object.create(future);

Fulfilled.prototype.when = function(f) {
	return typeof f !== 'function' ? new Fulfilled(this.value)
		: mapFuture(f, this.value);
};

// Future that has failed to produce a value
function Failed(e) {
	this.value = e;
}

Failed.prototype = Object.create(future);

Failed.prototype.when = function(f, r) {
	return typeof r !== 'function' ? new Failed(this.value)
		: mapFuture(r, this.value);
};

Fulfilled.prototype.join = Failed.prototype.join = function() {
	return this.value.when();
};

// Future whose fate is not yet revealed
function Pending() {
	this.value = never();
	this.resolved = false;
	this.queue = [];
}

Pending.prototype = Object.create(future);

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

function become(x, pending) {
	if(pending.resolved) {
		throw new Error('Future value already set');
	}

	pending.resolved = true;
	pending.value = x;
	resolve(pending.queue, x);
}

function mapFuture(f, x) {
	try {
		return new Fulfilled(f(x));
	} catch(e) {
		return new Failed(e);
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
	become(x.join(), this.p);
};
