export class AddForm {
  constructor(
    public nombre: string,
    public codigo: string,
    public ubicacion: string,
  ) { }
}


export class EditForm {
  constructor(
    public _id: string,
    public nombre: string,
    public codigo: string,
    public ubicacion: string,
  ) { }
}
