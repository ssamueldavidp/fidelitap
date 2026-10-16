import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:share_plus/share_plus.dart';
import '../data/mobile_api_client.dart';
import '../core/app_colors.dart';
import '../shared/wallet_preview_card.dart';

const _bgColors = [
  '#0B0B0B', '#1d4ed8', '#0f766e', '#7c3aed',
  '#dc2626', '#d97706', '#16a34a', '#db2777',
];

class PosterScreen extends StatefulWidget {
  final String cardId;
  final String cardName;
  const PosterScreen({super.key, required this.cardId, required this.cardName});

  @override
  State<PosterScreen> createState() => _PosterScreenState();
}

class _PosterScreenState extends State<PosterScreen> {
  final _api = MobileApiClient();
  final _rewardCtrl = TextEditingController();

  bool _loading = true;
  bool _saving = false;
  bool _uploadingBg = false;
  bool _generating = false;
  String? _error;

  String _bgType = 'color';
  String _bgColor = '#0B0B0B';
  String? _bgImageUrl;
  String _orientation = 'vertical';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _rewardCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final settings = await _api.getPosterSettings();
      final card = settings.cards.firstWhere(
        (c) => c.id == widget.cardId,
        orElse: () => PosterCardModel(id: widget.cardId, name: widget.cardName, stampsRequired: 1, posterRewardText: ''),
      );
      setState(() {
        _rewardCtrl.text = card.posterRewardText;
        _bgColor = settings.bgColor;
        _bgImageUrl = settings.bgImageUrl;
        _bgType = settings.bgImageUrl != null ? 'photo' : 'color';
        _loading = false;
      });
    } catch (e) {
      setState(() { _error = 'Error al cargar ajustes del cartel'; _loading = false; });
    }
  }

  Future<void> _pickBackground() async {
    final picker = ImagePicker();
    final img = await picker.pickImage(source: ImageSource.gallery, imageQuality: 85);
    if (img == null) return;
    final bytes = await img.readAsBytes();
    final mimeType = img.mimeType ?? 'image/jpeg';
    setState(() => _uploadingBg = true);
    try {
      final url = await _api.uploadPosterBackground(bytes, mimeType);
      setState(() { _bgImageUrl = url; _bgType = 'photo'; _uploadingBg = false; });
    } catch (e) {
      setState(() { _error = 'Error al subir la foto de fondo'; _uploadingBg = false; });
    }
  }

  Future<void> _save() async {
    setState(() { _saving = true; _error = null; });
    try {
      final res = await _api.savePosterSettings({
        'cardId': widget.cardId,
        'rewardText': _rewardCtrl.text.trim(),
        'bgType': _bgType,
        'bgColor': _bgColor,
        if (_bgType == 'photo') 'bgImageUrl': _bgImageUrl,
      });
      if (res.containsKey('error')) {
        setState(() { _error = res['error'] as String; _saving = false; });
        return;
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Ajustes guardados')));
      }
      setState(() => _saving = false);
    } catch (e) {
      setState(() { _error = 'Error al guardar'; _saving = false; });
    }
  }

  Future<void> _download(String format) async {
    setState(() { _generating = true; _error = null; });
    try {
      await _save();
      final bytes = await _api.downloadPoster(widget.cardId, format: format, orientation: _orientation);
      final ext = format == 'pdf' ? 'pdf' : 'png';
      final xfile = XFile.fromData(
        Uint8List.fromList(bytes),
        mimeType: format == 'pdf' ? 'application/pdf' : 'image/png',
        name: 'cartel_${widget.cardId}.$ext',
      );
      if (mounted) {
        await SharePlus.instance.share(ShareParams(
          files: [xfile],
          text: 'Cartel para ${widget.cardName}',
        ));
      }
    } catch (e) {
      setState(() => _error = 'Error al generar el cartel');
    } finally {
      if (mounted) setState(() => _generating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Scaffold(
      appBar: AppBar(title: const Text('Plantilla / Cartel')),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF0A9F5B)))
          : ListView(
              padding: const EdgeInsets.all(20),
              children: [
                Text('Personaliza y descarga el cartel para imprimir en tu negocio.',
                    style: TextStyle(color: colors.textSecondary, fontSize: 13)),
                const SizedBox(height: 20),

                if (_error != null) ...[
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEF4444).withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(_error!, style: const TextStyle(color: Color(0xFFEF4444))),
                  ),
                  const SizedBox(height: 16),
                ],

                _label(colors, 'Texto del premio en el cartel'),
                TextField(
                  controller: _rewardCtrl,
                  maxLength: 120,
                  style: TextStyle(color: colors.textPrimary),
                  decoration: InputDecoration(
                    hintText: 'ej. ¡Tu café #10 es gratis!',
                    hintStyle: TextStyle(color: colors.textMuted),
                    filled: true,
                    fillColor: colors.surfaceAlt,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                  ),
                ),
                const SizedBox(height: 20),

                _label(colors, 'Fondo del cartel'),
                Row(children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => setState(() => _bgType = 'color'),
                      style: OutlinedButton.styleFrom(
                        side: BorderSide(color: _bgType == 'color' ? const Color(0xFF0A9F5B) : colors.border),
                        foregroundColor: _bgType == 'color' ? const Color(0xFF0A9F5B) : colors.textMuted,
                      ),
                      child: const Text('Color'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => setState(() => _bgType = 'photo'),
                      style: OutlinedButton.styleFrom(
                        side: BorderSide(color: _bgType == 'photo' ? const Color(0xFF0A9F5B) : colors.border),
                        foregroundColor: _bgType == 'photo' ? const Color(0xFF0A9F5B) : colors.textMuted,
                      ),
                      child: const Text('Foto'),
                    ),
                  ),
                ]),
                const SizedBox(height: 12),

                if (_bgType == 'color')
                  Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: _bgColors.map((hex) {
                      final selected = _bgColor == hex;
                      return GestureDetector(
                        onTap: () => setState(() => _bgColor = hex),
                        child: Container(
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            color: hexToColor(hex),
                            shape: BoxShape.circle,
                            border: selected ? Border.all(color: colors.textPrimary, width: 2.5) : null,
                          ),
                        ),
                      );
                    }).toList(),
                  )
                else
                  GestureDetector(
                    onTap: _uploadingBg ? null : _pickBackground,
                    child: Container(
                      height: 100,
                      width: double.infinity,
                      decoration: BoxDecoration(
                        color: colors.surfaceAlt,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: colors.border),
                        image: _bgImageUrl != null
                            ? DecorationImage(image: NetworkImage(_bgImageUrl!), fit: BoxFit.cover)
                            : null,
                      ),
                      child: _uploadingBg
                          ? const Center(child: CircularProgressIndicator(strokeWidth: 2))
                          : _bgImageUrl == null
                              ? Center(
                                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                                    Icon(Icons.upload_outlined, color: colors.textMuted),
                                    const SizedBox(height: 4),
                                    Text('Subir foto de fondo', style: TextStyle(color: colors.textMuted, fontSize: 13)),
                                  ]),
                                )
                              : null,
                    ),
                  ),
                const SizedBox(height: 20),

                _label(colors, 'Orientación'),
                Row(children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => setState(() => _orientation = 'vertical'),
                      style: OutlinedButton.styleFrom(
                        side: BorderSide(color: _orientation == 'vertical' ? const Color(0xFF0A9F5B) : colors.border),
                        foregroundColor: _orientation == 'vertical' ? const Color(0xFF0A9F5B) : colors.textMuted,
                      ),
                      child: const Text('Vertical'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => setState(() => _orientation = 'horizontal'),
                      style: OutlinedButton.styleFrom(
                        side: BorderSide(color: _orientation == 'horizontal' ? const Color(0xFF0A9F5B) : colors.border),
                        foregroundColor: _orientation == 'horizontal' ? const Color(0xFF0A9F5B) : colors.textMuted,
                      ),
                      child: const Text('Horizontal'),
                    ),
                  ),
                ]),
                const SizedBox(height: 28),

                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton(
                    onPressed: _saving || _generating ? null : _save,
                    child: _saving
                        ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Text('Guardar ajustes'),
                  ),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: _generating ? null : () => _download('png'),
                    icon: const Icon(Icons.image_outlined),
                    label: _generating
                        ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Text('Descargar PNG'),
                  ),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: _generating ? null : () => _download('pdf'),
                    icon: const Icon(Icons.picture_as_pdf_outlined),
                    label: const Text('Descargar PDF'),
                  ),
                ),
              ],
            ),
    );
  }

  Widget _label(AppColors colors, String text) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Text(text,
            style: TextStyle(color: colors.textMuted, fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: 0.8)),
      );
}
