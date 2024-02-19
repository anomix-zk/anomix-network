import * as grpc from 'grpc';

// Define the gRPC service client
const client = new AnomixGRPCServiceClient(
  'localhost:50051',
  grpc.credentials.createInsecure()
);

// Define the gRPC service method
const request = new AnomixGRPCRequest();
client.connect(request, (error, response) => {
  if (error) {
    console.error('Error:', error);
    return;
  }
  console.log('Response:', response);
});
