import 'package:json_annotation/json_annotation.dart';
// ignore_for_file: deprecated_member_use
part 'log.g.dart';
@JsonSerializable()
class Log {
  @JsonKey()
  final String level;
  @JsonKey()
    final String timestamp;
  @JsonKey()
  final String? message;
  @JsonKey()
  final String? error;
  @JsonKey()
  final List<String>? stackTrace;

  const Log({
    required this.level,
    required this.timestamp,
    this.message,
    this.error,
    this.stackTrace,
  });

  Map<String, dynamic> toJson() => _$LogToJson(this);

  Log fromJson(Map<String, dynamic> json) => _$LogFromJson(json);
}
