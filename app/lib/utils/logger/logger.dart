import 'dart:convert';
import 'dart:math';

import 'package:app/utils/logger/log.dart';
import 'package:logger/logger.dart';

final logger = Logger(
  level: .debug,
  printer: Printer(
    methodCount: 5,
    errorMethodCount: 5,
    excludePaths: ['package:logger', 'package:app/utils/logger/'],
  ),
);

class Printer extends LogPrinter {
  final int? methodCount;
  final int? errorMethodCount;
  final List<String> excludePaths;
  late final JsonEncoder _jsonEncoder;

  Printer({
    this.methodCount = 5,
    this.errorMethodCount = 5,
    this.excludePaths = const [],
  }) : super() {
    _jsonEncoder = JsonEncoder.withIndent("  ", toEncodableFallback);
  }

  @override
  List<String> log(LogEvent event) {
    var messageStr = stringifyMessage(event.message);
    List<String>? stackTrace;
    if (event.error != null) {
      if ((errorMethodCount == null || errorMethodCount! > 0)) {
        stackTrace = formatStackTrace(
          event.stackTrace ?? StackTrace.current,
          errorMethodCount,
        );
      }
    } else if (methodCount == null || methodCount! > 0) {
      stackTrace = formatStackTrace(
        event.stackTrace ?? StackTrace.current,
        methodCount,
      );
    }

    var errorStr = event.error?.toString();

    String timeStamp = DateTime.timestamp().toIso8601String();
    final log = Log(
      level: event.level.name.toUpperCase(),
      timestamp: timeStamp,
      message: messageStr,
      stackTrace: stackTrace,
      error: errorStr,
    );
    return [
      "$timeStamp ${event.level.toString()}: ${_jsonEncoder.convert(log.toJson())}",
    ];
  }

  Object toEncodableFallback(dynamic object) {
    return object.toString();
  }

  String stringifyMessage(dynamic message) {
    final finalMessage = message is Function ? message() : message;
    if (finalMessage is Map || finalMessage is Iterable) {
      return _jsonEncoder.convert(finalMessage);
    } else {
      return finalMessage.toString();
    }
  }

  List<String> formatStackTrace(StackTrace? stackTrace, int? methodCount) {
    List<String> lines = stackTrace
        .toString()
        .split('\n')
        .where((line) => !_filterExcludedPaths(line))
        .where((line) => line.isNotEmpty)
        .toList();
    List<String> formatted = [];

    int stackTraceLength = (methodCount != null
        ? min(lines.length, methodCount)
        : lines.length);
    for (int count = 0; count < stackTraceLength; count++) {
      var line = lines[count];
      formatted.add('#$count   ${line.replaceFirst(RegExp(r'#\d+\s+'), '')}');
    }
    return formatted;
  }

  bool _filterExcludedPaths(String line) {
    for (final path in excludePaths) {
      if (line.contains(path)) {
        return true;
      }
    }
    return false;
  }
}
