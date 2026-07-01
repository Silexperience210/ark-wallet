use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;
use std::task::{Context, Poll};

use arti_client::DataStream;
use http::Uri;
use hyper_util::rt::TokioIo;
use rustls::pki_types::ServerName;
use rustls::ClientConfig;
use tokio_rustls::client::TlsStream;
use tokio_rustls::TlsConnector;
use tower_service::Service;

use super::service::TorService;

/// A Tower connector that opens a TCP stream through the embedded Tor client and
/// wraps it in TLS using the provided rustls config. TLS is handled here (rather
/// than by tonic) so we can pin the self-signed litd/tapd certificate, which
/// rustls' default webpki verifier rejects as a leaf (CaUsedAsEndEntity).
#[derive(Clone)]
pub struct ArtiConnector {
    service: TorService,
    tls: Arc<ClientConfig>,
    server_name: String,
}

impl ArtiConnector {
    pub fn new(service: TorService, tls: Arc<ClientConfig>, server_name: String) -> Self {
        Self {
            service,
            tls,
            server_name,
        }
    }
}

impl Service<Uri> for ArtiConnector {
    type Response = TokioIo<TlsStream<DataStream>>;
    type Error = String;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>> + Send>>;

    fn poll_ready(&mut self, _cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        Poll::Ready(Ok(()))
    }

    fn call(&mut self, uri: Uri) -> Self::Future {
        let service = self.service.clone();
        let tls = self.tls.clone();
        let server_name = self.server_name.clone();
        Box::pin(async move {
            let host = uri
                .host()
                .ok_or_else(|| "uri has no host".to_string())?
                .to_string();
            let port = uri.port_u16().unwrap_or(443);
            let stream = service.connect(&host, port).await?;
            let sni = ServerName::try_from(server_name)
                .map_err(|e| format!("invalid TLS server name: {e}"))?;
            let tls_stream = TlsConnector::from(tls)
                .connect(sni, stream)
                .await
                .map_err(|e| format!("tls handshake: {e}"))?;
            Ok(TokioIo::new(tls_stream))
        })
    }
}
