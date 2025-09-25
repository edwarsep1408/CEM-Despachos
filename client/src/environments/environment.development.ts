import { Environment } from './environment.interface';

let environment: Environment;

if (location.hostname == 'localhost' || location.hostname == '192.168.1.252') {

   environment = {
    production: true,
    apiUrl:'http://192.168.1.252:5001/api/v1',
    socketUrl: 'http://192.168.1.252:5001'

  };

 } else {
   environment = {
    production: true,
    apiUrl:'http://181.143.22.234:5001/api/v1',
    socketUrl: 'http://192.168.1.252:5001'
  };
 }


 export { environment }

