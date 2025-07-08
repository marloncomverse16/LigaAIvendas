/**
 * Script para testar o webhook de QR Code gerado
 */

import { sendQRCodeGeneratedWebhook } from './server/api/qr-connection-webhook.js';

async function testWebhook() {
  try {
    console.log('🧪 Testando webhook de QR Code gerado...');
    
    // Testar para o usuário admin (ID: 2)
    const userId = 2;
    const qrCodeData = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAYAAACtWK6eAAAAAXNSR0IArs4c6QAADTpJREFUeF7tnVty47gOBds3y8w9Ms+yZm6W+TfJW7lxZFu0JBIEge6/L4lINNDAgyhZ+fPnz5+//A8EQOA/BEqC0AsIgMB/CZAg9AII3CFAgtAdIECCgA0QmCZAgjwfmz9//vwNh+TP14tUHnrO71HFN/Zv3UbmmrE+rq1ItR3FRcb+tRP5N9bnmQi5S/9e+1sBSPgkQd5LbRKEBPlY4J4kLQlCgpAgX4/TDU8Ow+1vT6+xP2cggz+j2o7iImOTvwnLJQjvILyD8A7iwqSgUcvEeJcgSIK4MIHBJUFcVKFQSRBDTCwDe94MbPSX9CpvvrZ6b+Eeb722Y3sR7S5vD8P/nL1+3LT3kN9Rn/Cx3O4fErDTMvYV/vEg9S5u2z9rEsSZIMroLm/kOsroZzKDOq84BdWRIIVyZr8zqaOrtx0ShAQZ7GBtdK03E2UGVWb0d5GXd5Dt7iH9BwZpSRAShAQZfIKMvl+o4J/5vUQZ3eXNetOY9ZWWBCFBxklOApMgY9QGRtdG13ozkTL6Ge1TRn+nbfLEOtJHSBAShAQJPnkGRtdu3m30O9qCA9vE7PVnBjX6cXX4h/y8A9YkTEe9aAAAAABJRU5ErkJggg==";
    
    const result = await sendQRCodeGeneratedWebhook(userId, qrCodeData);
    
    if (result) {
      console.log('✅ Webhook enviado com sucesso!');
    } else {
      console.log('❌ Falha ao enviar webhook');
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
    process.exit(1);
  }
}

testWebhook();