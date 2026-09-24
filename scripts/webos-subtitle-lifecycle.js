'use strict';

// Serialized native commands, independent from metadata/timeupdate delivery.
// This function is embedded verbatim into the pinned Vidaa adapter by the patcher.
function createSubtitleLifecycle(options) {
    var timer = null, active = false, mediaId = '', generation = 0;
    var track = null, enabled = null, selected = null, appliedEnabled = null;
    var command = null, commandAttempts = 0, nextCommandAt = 0;
    var subscription = null, subscriptionToken = 0, subscribeAttempts = 0, retryAt = 0;

    function cancelSubscription() {
        subscriptionToken++;
        var previous = subscription;
        subscription = null;
        if (previous && previous.cancel) { try { previous.cancel(); } catch (_) {} }
    }

    function invalidate() {
        generation++;
        // A superseded in-flight command may still reach LG; reassert the latest
        // visibility intent even if it matches our last acknowledged value.
        if (command) appliedEnabled = null;
        command = null;
        commandAttempts = 0;
        nextCommandAt = 0;
    }

    function subscribe(now) {
        if (subscription || subscribeAttempts >= 8 || now < retryAt) return;
        var token = ++subscriptionToken, id = mediaId;
        // Placeholder handles synchronous callbacks and exceptions as well as webOS async callbacks.
        subscription = {};
        subscribeAttempts++;
        function current() { return active && token === subscriptionToken && mediaId === id && options.mediaId() === id; }
        function failed(error) {
            if (!current()) return;
            cancelSubscription();
            retryAt = options.now() + 400;
            options.onError('subscribe', error);
        }
        try {
            var request = options.request({
                method: 'subscribe', parameters: { mediaId: id, subscribe: true },
                onSuccess: function(data) {
                    if (!current()) return;
                    if (data && data.returnValue === false) return failed(data);
                    // sourceInfo is an event, not a required subscription acknowledgment.
                    if (data && data.sourceInfo) options.onSourceInfo();
                    var cue = data && data.userDefinedEvent && data.userDefinedEvent.subtitleData;
                    if (cue === undefined) cue = data && data.subtitleData;
                    if (cue && typeof cue === 'object') cue = cue.subtitleData;
                    if (typeof cue === 'string' && track !== null && selected === track) options.onCue(cue);
                },
                onFailure: failed
            });
            if (current() && subscription) subscription = request || {};
            else if (request && request.cancel) request.cancel();
        } catch (error) { failed(error); }
    }

    function tick() {
        if (!active) return;
        var id = options.mediaId();
        if (!id || id === '<invalid mediaId>') return;
        var now = options.now();
        if (id !== mediaId) {
            cancelSubscription();
            mediaId = id;
            selected = null;
            appliedEnabled = null;
            subscribeAttempts = 0;
            retryAt = 0;
            invalidate();
            options.onReset();
        }
        subscribe(now); // Deliberately before select/enable and before HAVE_METADATA.
        if (command && now - command.at < 1500) return;
        if (command) { command = null; nextCommandAt = now + 300; }
        if (now < nextCommandAt || commandAttempts >= 8) return;
        var selecting = track !== null && selected !== track;
        if (!selecting && (enabled === null || appliedEnabled === enabled)) return;
        var ticket = { at: now }, epoch = generation, wantedTrack = track, wantedEnabled = enabled;
        var method = selecting ? 'selectTrack' : 'setSubtitleEnable';
        command = ticket;
        commandAttempts++;
        function current() { return active && generation === epoch && command === ticket && options.mediaId() === id; }
        function failed(error) {
            if (!current()) return;
            command = null;
            nextCommandAt = options.now() + 300;
            options.onError(method, error);
        }
        try {
            options.request({
                method: method,
                parameters: selecting ? { mediaId: id, type: 'text', index: Number(wantedTrack.slice(9)) } : { mediaId: id, enable: wantedEnabled },
                onSuccess: function(data) {
                    if (!current()) return;
                    if (data && data.returnValue === false) return failed(data);
                    command = null;
                    commandAttempts = 0;
                    if (selecting) {
                        selected = wantedTrack;
                        appliedEnabled = null; // Enable only after the selected track is accepted.
                        options.onSelected(wantedTrack);
                    } else appliedEnabled = wantedEnabled;
                },
                onFailure: failed
            });
        } catch (error) { failed(error); }
    }

    return {
        start: function() {
            active = true;
            if (timer === null) timer = options.setInterval(tick, 100);
            tick();
        },
        stop: function() {
            active = false;
            invalidate();
            cancelSubscription();
            if (timer !== null) options.clearInterval(timer);
            timer = null;
            mediaId = '';
            track = selected = enabled = appliedEnabled = null;
        },
        select: function(id) {
            var next = /^EMBEDDED_\d+$/.test(id || '') ? id : null;
            if (next !== track) { track = next; selected = null; invalidate(); options.onReset(); }
            this.enable(next !== null);
        },
        enable: function(value) {
            if (enabled !== value) { enabled = value; invalidate(); }
            tick();
        },
        tick: tick
    };
}

module.exports = createSubtitleLifecycle;
