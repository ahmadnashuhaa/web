import 'dart:async';
import 'dart:convert';
import 'dart:js_interop';

import 'package:web/web.dart' as web;

/// Bridges scroll progress computed by the PARENT page (plain JS website)
/// into this embedded Flutter app.
///
/// Message contract (parent -> iframe), sent via
/// `iframe.contentWindow.postMessage(JSON.stringify(...), origin)`:
///
/// ```json
/// { "type": "progress", "value": 0.42 }
/// ```
///
/// `value` must already be clamped to [0, 1] on the JS side — this class
/// clamps again defensively but does not reinterpret the number.
class ScrollBridge {
  ScrollBridge._();
  static final ScrollBridge instance = ScrollBridge._();

  final StreamController<double> _controller =
      StreamController<double>.broadcast();

  /// Emits every time the parent page reports a new scroll progress value.
  Stream<double> get progressStream => _controller.stream;

  bool _listening = false;

  /// Starts listening for `message` events on `window`. Safe to call more
  /// than once — subsequent calls are no-ops.
  ///
  /// SECURITY NOTE: in production, replace the `expectedOrigin` check with
  /// your actual site origin (e.g. `https://yourdomain.com`) instead of
  /// accepting messages from any origin. This prevents an unrelated page
  /// from puppeteering this embedded app if it's ever loaded elsewhere.
  void listen({String? expectedOrigin}) {
    if (_listening) return;
    _listening = true;

    web.window.addEventListener(
      'message',
      (web.Event event) {
        final web.MessageEvent msg = event as web.MessageEvent;

        if (expectedOrigin != null && msg.origin != expectedOrigin) {
          return; // ignore messages from unexpected origins
        }

        final Object? data = msg.data.dartify();
        if (data is! String) return;

        try {
          final Map<String, dynamic> json =
              jsonDecode(data) as Map<String, dynamic>;
          if (json['type'] == 'progress' && json['value'] is num) {
            final double value = (json['value'] as num).toDouble();
            _controller.add(value.clamp(0.0, 1.0));
          }
        } catch (_) {
          // Malformed message — ignore rather than crash the embed.
        }
      }.toJS,
    );

    // Let the parent know we're alive and ready to receive progress.
    // The parent can use this to avoid sending messages before the
    // Flutter app has mounted.
    web.window.parent?.postMessage('{"type":"embed-ready"}'.toJS, '*'.toJS);
  }
}