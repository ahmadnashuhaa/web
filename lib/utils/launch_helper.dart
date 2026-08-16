import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

/// Opens [url] in the system browser / relevant app (WhatsApp, mail
/// client, file download, etc). Every "open externally" action in the
/// app should go through this one function so errors are handled the
/// same way everywhere.
Future<void> launchUrlExternal(BuildContext context, String url) async {
  final uri = Uri.parse(url);
  try {
    final launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!launched && context.mounted) {
      _showError(context, url);
    }
  } catch (_) {
    if (context.mounted) _showError(context, url);
  }
}

void _showError(BuildContext context, String url) {
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(content: Text('Could not open: $url')),
  );
}

/// Your WhatsApp number in international format, digits only
/// (no "+", no spaces, no dashes). Replace with your real number.
const String kWhatsAppNumber = '6281234567890';

/// Opens WhatsApp with a prefilled message built from whichever pieces
/// are provided. Used both for a quick "order this project" tap (only
/// [projectTitle] set) and for the full contact-form flow ([need],
/// [budget], [description] set from the form fields).
Future<void> openWhatsAppOrder(
  BuildContext context, {
  String? projectTitle,
  String? need,
  String? budget,
  String? description,
}) async {
  final buffer = StringBuffer('Halo, saya ingin memesan project.\n');

  if (projectTitle != null) {
    buffer.writeln('Project: $projectTitle');
  }
  if (need != null) {
    buffer.writeln('Kebutuhan: $need');
  }
  if (budget != null) {
    buffer.writeln('Budget: $budget');
  }
  if (description != null && description.trim().isNotEmpty) {
    buffer.writeln('Detail: ${description.trim()}');
  }

  final message = buffer.toString().trim();
  final encoded = Uri.encodeComponent(message);
  await launchUrlExternal(context, 'https://wa.me/$kWhatsAppNumber?text=$encoded');
}