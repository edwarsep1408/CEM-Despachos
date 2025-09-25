export class AddForm {
  constructor(
   public bodega: string,
   public mesa: string,
   public nombre: string,
   public cedula: string,
   public perfil: string,
  ) { }
}


export class EditForm {
  constructor(
    public _id: string,
    public bodega: string,
    public mesa: string,
    public nombre: string,
    public cedula: string,
    public perfil: string,
  ) { }
}
