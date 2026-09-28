import SwiftUI
import PhotosUI
import CoreTransferable
import UniformTypeIdentifiers

/// Wählt einen Screenshot oder ein Bildschirmvideo aus der Mediathek und erkennt die Kartendaten.
struct ScanButton: View {
    var title = "Screenshot / Video scannen"
    /// Nur Symbol (für die Navigationsleiste).
    var compact = false
    let knownNames: [String]
    let onResult: (ScanResult) -> Void

    @State private var item: PhotosPickerItem?
    @State private var isScanning = false
    @State private var errorText: String?

    var body: some View {
        PhotosPicker(selection: $item, matching: .any(of: [.screenshots, .images, .videos, .screenRecordings])) {
            if compact {
                if isScanning {
                    ProgressView()
                } else {
                    Image(systemName: "text.viewfinder").font(.title3)
                }
            } else {
                HStack {
                    Image(systemName: "text.viewfinder")
                        .font(.title3)
                    Text(isScanning ? "Erkenne Daten …" : title)
                    Spacer()
                    if isScanning { ProgressView() }
                }
            }
        }
        .disabled(isScanning)
        .onChange(of: item) { _, newItem in
            guard let newItem else { return }
            Task { await scan(newItem) }
        }
        .alert("Scan fehlgeschlagen", isPresented: Binding(get: { errorText != nil }, set: { if !$0 { errorText = nil } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorText ?? "")
        }
    }

    private func scan(_ item: PhotosPickerItem) async {
        isScanning = true
        defer {
            isScanning = false
            self.item = nil
        }
        do {
            let frames: [[TextLine]]
            if item.supportedContentTypes.contains(where: { $0.conforms(to: .movie) }) {
                guard let movie = try await item.loadTransferable(type: PickedMovie.self) else {
                    throw ScanError.unreadable
                }
                defer { try? FileManager.default.removeItem(at: movie.url) }
                frames = try await TextRecognizer.frames(inVideoAt: movie.url)
            } else {
                guard let data = try await item.loadTransferable(type: Data.self),
                      let image = UIImage(data: data)?.cgImage else {
                    throw ScanError.unreadable
                }
                frames = [try await TextRecognizer.lines(in: image)]
            }
            let result = ScreenshotParser.parse(frames: frames, knownNames: knownNames)
            if result.isEmpty { throw ScanError.nothingFound }
            onResult(result)
        } catch {
            errorText = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }
}

enum ScanError: LocalizedError {
    case unreadable, nothingFound

    var errorDescription: String? {
        switch self {
        case .unreadable: return "Die Datei konnte nicht geladen werden."
        case .nothingFound: return "Auf dem Bild wurde kein Text erkannt."
        }
    }
}

/// Video aus der Mediathek als temporäre Datei.
struct PickedMovie: Transferable {
    let url: URL

    static var transferRepresentation: some TransferRepresentation {
        FileRepresentation(contentType: .movie) { movie in
            SentTransferredFile(movie.url)
        } importing: { received in
            let ext = received.file.pathExtension.isEmpty ? "mov" : received.file.pathExtension
            let destination = FileManager.default.temporaryDirectory
                .appendingPathComponent(UUID().uuidString)
                .appendingPathExtension(ext)
            try FileManager.default.copyItem(at: received.file, to: destination)
            return PickedMovie(url: destination)
        }
    }
}
